/**
 * Offline sale queue. Sales taken while the API is unreachable are stored in
 * IndexedDB with their uuid clientRef (the server's idempotency key), local
 * stock is decremented optimistically and a provisional bill OFF-<device>-<seq>
 * is printed. `syncPending` replays them through POST /pos/sales/sync in
 * batches of ≤50:
 *   created | duplicate → done (removed from queue, result kept)
 *   conflict            → recorded server-side; kept in syncResults until acknowledged
 *   error               → stays queued, retried with backoff, flagged for a manager
 * Nothing is ever dropped silently.
 */
import { salesApi } from "@/lib/api/sales";
import { ApiError, friendlyError } from "@/lib/api/errors";
import type { BillData, SalePayload, SyncResult } from "@/lib/api/types";
import { decrementLocalStock } from "./catalog-cache";
import { db, getMeta, setMeta, type PendingSale, type StoredSyncResult } from "./db";

export const SYNC_BATCH_SIZE = 50;
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 60 * 60_000;

export function backoffMs(attempts: number) {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

export function newClientRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function deviceId(): Promise<string> {
  let id = await getMeta<string>("deviceId");
  if (!id) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    id = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    await setMeta("deviceId", id);
  }
  return id;
}

/** Next provisional bill number for this device: OFF-<device>-<seq>. */
export async function nextProvisionalRef(): Promise<string> {
  const device = await deviceId();
  const seq = ((await getMeta<number>("offlineSeq")) ?? 0) + 1;
  await setMeta("offlineSeq", seq);
  return `OFF-${device}-${String(seq).padStart(4, "0")}`;
}

/** Queue a sale for later sync; decrements cached stock; returns the stored row. */
export async function queueSale(payload: SalePayload, bill: Omit<BillData, "printableRef">): Promise<PendingSale> {
  const provisionalRef = await nextProvisionalRef();
  const row: PendingSale = {
    clientRef: payload.clientRef,
    payload: { ...payload, createdAt: payload.createdAt ?? new Date().toISOString() },
    provisionalRef,
    bill: { ...bill, printableRef: provisionalRef, provisional: true },
    total: bill.total,
    status: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    needsAttention: false,
    createdAt: Date.now(),
  };
  await db().pendingSales.put(row);
  for (const item of payload.items) await decrementLocalStock(item.productId, item.variantId ?? null, item.quantity);
  return row;
}

export interface SyncOutcome {
  sent: number;
  created: number;
  duplicate: number;
  conflict: number;
  error: number;
  networkFailure: boolean;
}

type SyncFn = (sales: SalePayload[]) => Promise<{ results: SyncResult[] }>;

let running: Promise<SyncOutcome> | null = null;

/** Replay due queued sales. Concurrent calls share one run. */
export function syncPending(opts: { send?: SyncFn; now?: () => number } = {}): Promise<SyncOutcome> {
  if (!running) running = runSync(opts).finally(() => { running = null; });
  return running;
}

async function runSync({ send = salesApi.sync, now = Date.now }: { send?: SyncFn; now?: () => number }): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { sent: 0, created: 0, duplicate: 0, conflict: 0, error: 0, networkFailure: false };
  const table = db().pendingSales;
  for (;;) {
    const due = (await table.orderBy("createdAt").toArray()).filter((s) => s.status !== "syncing" && s.nextAttemptAt <= now()).slice(0, SYNC_BATCH_SIZE);
    if (!due.length) break;
    await table.bulkPut(due.map((s) => ({ ...s, status: "syncing" as const })));
    let results: SyncResult[];
    try {
      results = (await send(due.map((s) => s.payload))).results ?? [];
    } catch (err) {
      const network = err instanceof ApiError ? err.isNetwork : true;
      outcome.networkFailure = network;
      await table.bulkPut(due.map((s) => retryRow(s, friendlyError(err), now(), false)));
      break;
    }
    outcome.sent += due.length;
    const byRef = new Map(results.map((r) => [r.clientRef, r]));
    for (const sale of due) {
      const r = byRef.get(sale.clientRef);
      if (!r) {
        await table.put(retryRow(sale, "No result returned for this sale", now(), false));
        outcome.error++;
        continue;
      }
      if (r.status === "error") {
        await table.put(retryRow(sale, r.reason ?? "Rejected by server", now(), true));
        outcome.error++;
        continue;
      }
      const stored: StoredSyncResult = {
        ...r,
        provisionalRef: sale.provisionalRef,
        total: sale.total,
        syncedAt: now(),
        acknowledged: r.status !== "conflict",
      };
      await db().transaction("rw", table, db().syncResults, async () => {
        await db().syncResults.put(stored);
        await table.delete(sale.clientRef);
      });
      outcome[r.status]++;
    }
    if (due.length < SYNC_BATCH_SIZE) break;
  }
  return outcome;
}

function retryRow(sale: PendingSale, reason: string, at: number, validation: boolean): PendingSale {
  const attempts = sale.attempts + 1;
  return {
    ...sale,
    status: "error",
    attempts,
    lastError: reason,
    needsAttention: sale.needsAttention || validation,
    nextAttemptAt: at + backoffMs(attempts),
  };
}

/** Force an immediate retry of one queued sale (manager action). */
export async function retryNow(clientRef: string) {
  const row = await db().pendingSales.get(clientRef);
  if (row) await db().pendingSales.put({ ...row, status: "pending", nextAttemptAt: 0 });
}

export async function acknowledgeResult(clientRef: string) {
  const row = await db().syncResults.get(clientRef);
  if (row) await db().syncResults.put({ ...row, acknowledged: true });
}

export async function queueCounts() {
  const pending = await db().pendingSales.toArray();
  const conflicts = await db().syncResults.where("status").equals("conflict").filter((r) => !r.acknowledged).count();
  return {
    pending: pending.length,
    needsAttention: pending.filter((p) => p.needsAttention).length,
    conflicts,
  };
}

/** After a crash mid-sync, rows stuck in "syncing" are safe to resend (clientRef is idempotent). */
export async function recoverStuck() {
  const stuck = await db().pendingSales.where("status").equals("syncing").toArray();
  if (stuck.length) await db().pendingSales.bulkPut(stuck.map((s) => ({ ...s, status: "pending" as const })));
}
