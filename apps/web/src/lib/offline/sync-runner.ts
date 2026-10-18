/** Background loop: catalog delta refresh + offline sale replay on reconnect / interval. */
import { create } from "zustand";
import { usePosConfig } from "@/lib/pos/config-store";
import { refreshCatalog } from "./catalog-cache";
import { db } from "./db";
import { queueCounts, recoverStuck, syncPending } from "./queue";

export interface OfflineState {
  /** Browser says online AND the last API attempt didn't fail at the network level. */
  online: boolean;
  pending: number;
  needsAttention: number;
  conflicts: number;
  syncing: boolean;
  lastSyncAt: number | null;
  catalogCount: number;
  catalogSyncedAt: number | null;
  setOnline: (online: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  online: true,
  pending: 0,
  needsAttention: 0,
  conflicts: 0,
  syncing: false,
  lastSyncAt: null,
  catalogCount: 0,
  catalogSyncedAt: null,
  setOnline: (online) => set({ online }),
}));

export async function refreshCounts() {
  const counts = await queueCounts();
  const catalogCount = await db().products.count();
  useOfflineStore.setState({ ...counts, catalogCount });
}

const CONFIG_REFRESH_MS = 2 * 60_000;
let lastConfigAt = Date.now();

/** One cycle: replay queue, then pull catalog deltas. Safe to call often. */
export async function runSyncCycle(opts: { fullCatalog?: boolean } = {}) {
  const store = useOfflineStore.getState();
  if (store.syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useOfflineStore.setState({ online: false });
    await refreshCounts();
    return;
  }
  useOfflineStore.setState({ syncing: true });
  try {
    const outcome = await syncPending();
    let online = !outcome.networkFailure;
    try {
      await refreshCatalog({ full: opts.fullCatalog });
      useOfflineStore.setState({ catalogSyncedAt: Date.now() });
    } catch (err) {
      if ((err as { isNetwork?: boolean })?.isNetwork) online = false;
    }
    // Owner may have switched a payment method / VAT off: keep every counter current.
    if (online && Date.now() - lastConfigAt > CONFIG_REFRESH_MS) {
      lastConfigAt = Date.now();
      await usePosConfig.getState().refresh();
    }
    useOfflineStore.setState({ online, lastSyncAt: Date.now() });
  } finally {
    useOfflineStore.setState({ syncing: false });
    await refreshCounts();
  }
}

let started = false;

export function startOfflineRunner(intervalMs = 30_000): () => void {
  if (started || typeof window === "undefined") return () => undefined;
  started = true;
  const onOnline = () => {
    useOfflineStore.setState({ online: true });
    void runSyncCycle();
  };
  const onOffline = () => useOfflineStore.setState({ online: false });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  useOfflineStore.setState({ online: navigator.onLine });
  void recoverStuck().then(() => runSyncCycle());
  const timer = window.setInterval(() => void runSyncCycle(), intervalMs);
  return () => {
    started = false;
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.clearInterval(timer);
  };
}
