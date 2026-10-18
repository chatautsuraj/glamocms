/**
 * Optional cash drawer count. The API keeps its v1 path (/pos/till/*);
 * open = "cash in drawer when you start", close = "cash counted at end of day".
 * Selling never depends on it.
 */
import { api } from "./client";
import type { DrawerShift } from "./types";

export const cashDrawerApi = {
  current: () => api.get<DrawerShift | null>("/pos/till/current"),
  start: (startingCash: number) => api.post<DrawerShift>("/pos/till/open", { openingFloat: startingCash }),
  count: (countedCash: number, notes?: string) => api.post<DrawerShift>("/pos/till/close", { closingCash: countedCash, notes: notes || undefined }),
  history: (q: { from?: string; to?: string; cashierId?: string; page?: number }) => api.list<DrawerShift>("/pos/till/shifts", q),
};
