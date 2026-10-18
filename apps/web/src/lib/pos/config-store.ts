/**
 * Selling configuration every POS user receives (session.posConfig, refreshed
 * from GET /pos/config): VAT switch + rate, payment methods and their QR codes,
 * bill footer, label size, store profile. Cached in IndexedDB so an offline
 * counter keeps the owner's settings.
 */
import { useMemo } from "react";
import { create } from "zustand";
import { sessionApi } from "@/lib/api/session";
import type { PaymentMethod, PosConfig } from "@/lib/api/types";
import { getMeta, setMeta } from "@/lib/offline/db";
import { enabledPaymentMethods } from "./payments";

const CACHE_KEY = "posConfig";

interface PosConfigState {
  config: PosConfig | null;
  set: (config: PosConfig) => void;
  /** Restore the cached copy (offline start). */
  hydrate: () => Promise<void>;
  /** Re-read GET /pos/config (after settings change / periodically). Errors are swallowed. */
  refresh: () => Promise<PosConfig | null>;
}

export const usePosConfig = create<PosConfigState>((set, get) => ({
  config: null,
  set(config) {
    set({ config });
    void setMeta(CACHE_KEY, config).catch(() => undefined);
  },
  async hydrate() {
    if (get().config) return;
    const cached = await getMeta<PosConfig>(CACHE_KEY).catch(() => undefined);
    if (cached && !get().config) set({ config: cached });
  },
  async refresh() {
    try {
      const next = await sessionApi.config();
      get().set(next);
      return next;
    } catch {
      return null;
    }
  },
}));

/** VAT as the counter must apply it right now. */
export interface VatConfig {
  enabled: boolean;
  rate: number;
}

const NO_CONFIG_VAT: VatConfig = { enabled: false, rate: 0 };

export function vatOf(config: PosConfig | null): VatConfig {
  if (!config) return NO_CONFIG_VAT;
  return { enabled: config.vatEnabled, rate: config.vatEnabled ? config.vatRate : 0 };
}

export const useVatEnabled = () => usePosConfig((s) => s.config?.vatEnabled ?? false);
export const useVatRate = () => usePosConfig((s) => (s.config?.vatEnabled ? s.config.vatRate : 0));

/** Enabled payment methods (stable string key → re-render only when the set changes). */
export function useEnabledMethods(): PaymentMethod[] {
  const key = usePosConfig((s) => enabledPaymentMethods(s.config?.payments).join(","));
  return useMemo(() => key.split(",") as PaymentMethod[], [key]);
}
