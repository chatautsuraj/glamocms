/** POS session endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { PosSession } from "./types";

export const sessionApi = {
  create: () => api.post<PosSession>("/pos/session", {}, { quiet: true }),
};
