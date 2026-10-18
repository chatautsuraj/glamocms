/** POS settings cache (vatRate, footer, discount cap). Readable by settings.read; cashiers use defaults. */
import { create } from "zustand";
import { settingsApi } from "@/lib/api/settings";
import type { PosSettings } from "@/lib/api/types";
import { DEFAULT_VAT_RATE } from "@/lib/pos/math";
import { getMeta, setMeta } from "@/lib/offline/db";

interface SettingsState {
  settings: PosSettings | null;
  vatRate: number;
  load: (canRead: boolean) => Promise<void>;
  set: (s: PosSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  vatRate: DEFAULT_VAT_RATE,
  async load(canRead) {
    const cached = await getMeta<PosSettings>("settings").catch(() => undefined);
    if (cached) set({ settings: cached, vatRate: cached.pos.vatRate });
    if (!canRead) return;
    try {
      const s = await settingsApi.get();
      set({ settings: s, vatRate: s.pos.vatRate });
      await setMeta("settings", s);
    } catch {
      /* keep cached/defaults */
    }
  },
  set(s) {
    set({ settings: s, vatRate: s.pos.vatRate });
    void setMeta("settings", s);
  },
}));
