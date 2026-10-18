/** Live POST /pos/sales with automatic fallback to the offline queue on network failure. */
import { salesApi } from "@/lib/api/sales";
import { ApiError } from "@/lib/api/errors";
import type { BillData, PosOrder, SalePayload } from "@/lib/api/types";
import { decrementLocalStock } from "@/lib/offline/catalog-cache";
import { queueSale } from "@/lib/offline/queue";
import { refreshCounts, useOfflineStore } from "@/lib/offline/sync-runner";

export interface SubmittedSale {
  bill: BillData;
  order?: PosOrder;
  offline: boolean;
  duplicate?: boolean;
}

export async function submitSale(payload: SalePayload, localBill: Omit<BillData, "printableRef">): Promise<SubmittedSale> {
  if (useOfflineStore.getState().online) {
    try {
      const res = await salesApi.create(payload);
      for (const item of payload.items) await decrementLocalStock(item.productId, item.variantId ?? null, item.quantity).catch(() => undefined);
      return { bill: { ...res.bill, channel: localBill.channel ?? res.order.channel }, order: res.order, offline: false, duplicate: res.duplicate };
    } catch (err) {
      if (!(err instanceof ApiError && err.isNetwork)) throw err;
      useOfflineStore.setState({ online: false });
    }
  }
  const row = await queueSale(payload, localBill);
  await refreshCounts();
  return { bill: row.bill, offline: true };
}
