/**
 * Offline / Vercel fallback when Nest API (GLAMO_API_URL) is unreachable.
 * Serves the bundled Glamo catalog so Products / POS still load.
 */

import catalogJson from "@/lib/glamo-catalog.json";
import type { ApiProduct } from "@/lib/commerce-client";

type CatalogRow = {
  sourceId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  regularPrice?: number;
  stock: number;
  reorderAt?: number;
  size?: string;
  image?: string;
  shadeOptions?: string[];
};

const rows = catalogJson as CatalogRow[];

function toApi(row: CatalogRow): ApiProduct {
  return {
    id: row.sourceId,
    name: row.name,
    sku: row.sku,
    price: row.price,
    stock: row.stock,
    category: row.category ?? null,
    images: row.image ? [row.image] : [],
    brand: row.brand ?? null,
    shade: row.shadeOptions?.[0] ?? null,
    batchNumber: null,
    expiresOn: null,
    isTester: false,
    size: row.size ?? null,
    mrp: row.regularPrice ?? row.price,
    reorderAt: row.reorderAt ?? 5,
    galla: true,
    vatApplicable: false,
  };
}

let cache: ApiProduct[] | null = null;

export function getFallbackProducts(opts?: { q?: string; category?: string }): ApiProduct[] {
  if (!cache) cache = rows.map(toApi);
  let list = cache;
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }
  const cat = opts?.category?.trim().toLowerCase();
  if (cat) {
    list = list.filter((p) => (p.category ?? "").toLowerCase() === cat);
  }
  return list;
}

export function getFallbackProduct(id: string): ApiProduct | null {
  if (!cache) cache = rows.map(toApi);
  return (
    cache.find((p) => p.id === id || p.sku === id) ??
    null
  );
}

export function shouldUseCatalogFallback(apiError: unknown): boolean {
  if (typeof apiError === "string") {
    const s = apiError.toLowerCase();
    return (
      s.includes("fetch failed") ||
      s.includes("econnrefused") ||
      s.includes("enotfound") ||
      s.includes("upstream") ||
      s.includes("network")
    );
  }
  return true;
}
