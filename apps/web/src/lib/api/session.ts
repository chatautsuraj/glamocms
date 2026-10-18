/** POS session + selling config — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { PosConfig, PosSession } from "./types";

export const sessionApi = {
  create: () => api.post<PosSession>("/pos/session", {}, { quiet: true }),
  config: () => api.get<PosConfig>("/pos/config", undefined, { quiet: true }),
};
