/** POS catalog endpoints — products, photos, shades/variants, barcodes (POS-API-CONTRACT.md v2). */
import { api, requestEnvelope, type Query } from "./client";
import type { PosImage, PosProduct, PosProductWrite, PosVariant, VariantWrite } from "./types";

const enc = encodeURIComponent;

export interface ImagesResult {
  image: PosImage;
  images: PosImage[];
}

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
  remove: (id: string) => api.del<{ id: string; deleted: true }>(`/pos/products/${enc(id)}`),
  /** Reserve the next in-store EAN-13 for the product form's "Generate" button. */
  nextBarcode: () => api.post<{ barcode: string }>("/pos/barcodes/next", {}),

  uploadImage: (productId: string, file: File) => api.upload<ImagesResult>(`/pos/products/${enc(productId)}/images`, file),
  addImageUrl: (productId: string, url: string) => api.post<ImagesResult>(`/pos/products/${enc(productId)}/images/url`, { url }),
  updateImage: (productId: string, imageId: string, body: { isPrimary?: true; sortOrder?: number }) =>
    api.patch<ImagesResult>(`/pos/products/${enc(productId)}/images/${enc(imageId)}`, body),
  deleteImage: (productId: string, imageId: string) =>
    api.del<{ id: string; deleted: true; images: PosImage[] }>(`/pos/products/${enc(productId)}/images/${enc(imageId)}`),

  createVariant: (productId: string, body: VariantWrite & { stock?: number }) =>
    api.post<{ variant: PosVariant; product: PosProduct }>(`/pos/products/${enc(productId)}/variants`, body),
  updateVariant: (productId: string, variantId: string, body: Partial<VariantWrite> & { isActive?: boolean }) =>
    api.patch<{ variant: PosVariant | null; product: PosProduct }>(`/pos/products/${enc(productId)}/variants/${enc(variantId)}`, body),
  deleteVariant: (productId: string, variantId: string) =>
    api.del<{ id: string; deleted: true; product: PosProduct }>(`/pos/products/${enc(productId)}/variants/${enc(variantId)}`),
};
