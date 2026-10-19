/** POS customers endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { Customer, CustomerDetail, CustomerStats } from "./types";

const enc = encodeURIComponent;

export type CustomerFilter = "all" | "repeat" | "new" | "marketing";

export type CustomerWrite = { name: string; phone: string; email?: string; address?: string; marketingConsent?: boolean };

export const customersApi = {
  list: (q: { q?: string; page?: number; filter?: CustomerFilter }) => api.list<Customer>("/pos/customers", q),
  stats: () => api.get<CustomerStats>("/pos/customers/stats"),
  get: (id: string) => api.get<CustomerDetail>(`/pos/customers/${enc(id)}`),
  create: (body: CustomerWrite) => api.post<Customer>("/pos/customers", body),
  update: (id: string, body: Partial<Omit<CustomerWrite, "email">> & { email?: string | null }) => api.patch<Customer>(`/pos/customers/${enc(id)}`, body),
};
