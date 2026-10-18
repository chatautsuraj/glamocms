/** POS sales endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { SalePayload, SaleResult, SyncResult } from "./types";

export const salesApi = {
  create: (payload: SalePayload) => api.post<SaleResult>("/pos/sales", payload),
  sync: (sales: SalePayload[]) => api.post<{ results: SyncResult[] }>("/pos/sales/sync", { sales }),
};
