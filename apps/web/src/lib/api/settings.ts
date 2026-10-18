/** POS settings endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { PosSettings, PosSettingsPatch } from "./types";

export const settingsApi = {
  get: () => api.get<PosSettings>("/pos/settings"),
  update: (patch: PosSettingsPatch) => api.patch<PosSettings>("/pos/settings", patch),
};
