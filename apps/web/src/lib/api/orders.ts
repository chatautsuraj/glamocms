/** POS orders endpoints — see POS-API-CONTRACT.md. */
import { api, type Query } from "./client";
import type { Channel, OrderStatus, PaymentMethod, PosOrder } from "./types";

const enc = encodeURIComponent;

export interface OrderQuery {
  channel?: Channel | "";
  /** One status or a comma-separated list. */
  status?: OrderStatus | "" | string;
  paymentStatus?: string;
  from?: string;
  to?: string;
  q?: string;
  cashierId?: string;
  page?: number;
  limit?: number;
}

export const ordersApi = {
  list: (q: OrderQuery) => api.list<PosOrder>("/pos/orders", q as unknown as Query),
  get: (id: string) => api.get<PosOrder>(`/pos/orders/${enc(id)}`),
  setStatus: (id: string, status: OrderStatus, note?: string) => api.patch<PosOrder>(`/pos/orders/${enc(id)}/status`, { status, note: note || undefined }),
  cancel: (id: string, reason: string, restock: boolean) => api.post<PosOrder>(`/pos/orders/${enc(id)}/cancel`, { reason, restock }),
  refund: (id: string, body: { items?: Array<{ orderItemId: string; quantity: number }>; amount: number; method: PaymentMethod; reason: string; restock: boolean; reference?: string }) =>
    api.post<PosOrder>(`/pos/orders/${enc(id)}/refund`, body),
};
