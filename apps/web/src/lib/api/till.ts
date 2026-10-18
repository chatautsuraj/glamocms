/** POS till endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { TillShift } from "./types";

export const tillApi = {
  current: () => api.get<TillShift | null>("/pos/till/current"),
  open: (openingFloat: number) => api.post<TillShift>("/pos/till/open", { openingFloat }),
  close: (closingCash: number, notes?: string) => api.post<TillShift>("/pos/till/close", { closingCash, notes: notes || undefined }),
  shifts: (q: { from?: string; to?: string; cashierId?: string; page?: number }) => api.list<TillShift>("/pos/till/shifts", q),
};
