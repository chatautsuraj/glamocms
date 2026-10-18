/** POS delivery endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { NcmBranch, NcmRate, Shipment } from "./types";

const enc = encodeURIComponent;

export const deliveryApi = {
  branches: (refresh = false) => api.get<NcmBranch[]>("/pos/delivery/branches", { refresh: refresh ? 1 : undefined }),
  rate: (destination: string, type?: string) => api.get<NcmRate>("/pos/delivery/rate", { destination, type }),
  shipment: (orderId: string) => api.get<Shipment | null>(`/pos/orders/${enc(orderId)}/shipment`),
  send: (orderId: string, body: { branch?: string; deliveryType?: string; weight?: number; instruction?: string; codAmount?: number } = {}) =>
    api.post<Shipment>(`/pos/orders/${enc(orderId)}/shipment`, body),
  refresh: (orderId: string) => api.post<Shipment>(`/pos/orders/${enc(orderId)}/shipment/refresh`, {}),
};
