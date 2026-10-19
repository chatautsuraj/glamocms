/** Categories & brands managed from the POS (GET: pos.sell, writes: catalog.write). */
import { api } from "./client";
import type { Brand, Category } from "./types";

const enc = encodeURIComponent;

export type CategoryWrite = { name: string; parentId?: string | null; description?: string | null; isActive?: boolean; sortOrder?: number };
export type BrandWrite = { name: string; description?: string | null; website?: string | null; isActive?: boolean };

export const taxonomyApi = {
  categories: () => api.get<Category[]>("/pos/categories"),
  createCategory: (body: CategoryWrite) => api.post<Category>("/pos/categories", body),
  updateCategory: (id: string, body: Partial<CategoryWrite>) => api.patch<Category>(`/pos/categories/${enc(id)}`, body),
  brands: () => api.get<Brand[]>("/pos/brands"),
  createBrand: (body: BrandWrite) => api.post<Brand>("/pos/brands", body),
  updateBrand: (id: string, body: Partial<BrandWrite>) => api.patch<Brand>(`/pos/brands/${enc(id)}`, body),
};
