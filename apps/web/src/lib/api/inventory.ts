/** POS inventory endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { InventoryMovement, InventoryReason, SyncConflict } from "./types";

const enc = encodeURIComponent;

export const inventoryApi = {
  adjust: (body: { productId: string; variantId?: string; delta: number; reason: InventoryReason; note?: string }) =>
    api.post<{ stock: number }>("/pos/inventory/adjust", body),
  movements: (q: { productId?: string; page?: number; limit?: number }) => api.list<InventoryMovement>("/pos/inventory/movements", q),
  conflicts: (status: "open" | "resolved" | "all" = "open", page = 1) => api.list<SyncConflict>("/pos/sync/conflicts", { status, page }),
  resolveConflict: (id: string, note: string) => api.post<{ id: string; status: string }>(`/pos/sync/conflicts/${enc(id)}/resolve`, { note }),
};
