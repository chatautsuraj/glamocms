/** POS catalog endpoints — see POS-API-CONTRACT.md. */
import { api, requestEnvelope, type Query } from "./client";
import type { Brand, Category, PosProduct, PosProductWrite } from "./types";

const enc = encodeURIComponent;

export const catalogApi = {
  /** Full snapshot (no param) or delta since `updatedSince`; returns meta.serverTime for the next delta. */
  async snapshot(updatedSince?: string): Promise<{ products: PosProduct[]; serverTime: string | null }> {
    const env = await requestEnvelope<PosProduct[]>("GET", "/pos/catalog", { query: { updatedSince } });
    return { products: env.data ?? [], serverTime: env.meta?.serverTime ?? null };
  },
  lookup: (code: string) => api.get<PosProduct>("/pos/lookup", { code }),
  list: (q: Query) => api.list<PosProduct>("/pos/products", q),
  get: (id: string) => api.get<PosProduct>(`/pos/products/${enc(id)}`),
  create: (body: PosProductWrite) => api.post<PosProduct>("/pos/products", body),
  update: (id: string, body: Partial<PosProductWrite>) => api.patch<PosProduct>(`/pos/products/${enc(id)}`, body),
  remove: (id: string) => api.del<unknown>(`/pos/products/${enc(id)}`),
  async categories(): Promise<Category[]> {
    const data = await api.get<unknown>("/categories");
    return normaliseList<Category>(data, "categories");
  },
  async brands(): Promise<Brand[]> {
    const data = await api.get<unknown>("/brands");
    return normaliseList<Brand>(data, "brands");
  },
};

function normaliseList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}
