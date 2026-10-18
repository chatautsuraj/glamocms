/** POS customers endpoints — see POS-API-CONTRACT.md. */
import { api, requestEnvelope } from "./client";
import type { Customer, CustomerDetail, KhataEntry, PaymentMethod } from "./types";

const enc = encodeURIComponent;

export const customersApi = {
  list: (q: { q?: string; page?: number }) => api.list<Customer>("/pos/customers", q),
  get: (id: string) => api.get<CustomerDetail>(`/pos/customers/${enc(id)}`),
  create: (body: { name: string; phone: string; email?: string; address?: string; marketingConsent?: boolean }) => api.post<Customer>("/pos/customers", body),
  update: (id: string, body: Partial<{ name: string; phone: string; email: string | null; address: string; marketingConsent: boolean }>) =>
    api.patch<Customer>(`/pos/customers/${enc(id)}`, body),
  async khata(id: string, page = 1): Promise<{ balance: number; entries: KhataEntry[]; total: number }> {
    const env = await requestEnvelope<{ balance: number; entries: KhataEntry[] }>("GET", `/pos/customers/${enc(id)}/khata`, { query: { page } });
    return { balance: env.data?.balance ?? 0, entries: env.data?.entries ?? [], total: env.meta?.total ?? 0 };
  },
  addKhata: (id: string, body: { type: "CHARGE" | "PAYMENT"; amount: number; method?: PaymentMethod; note?: string }) =>
    api.post<{ id: string; balance: number }>(`/pos/customers/${enc(id)}/khata`, body),
};
