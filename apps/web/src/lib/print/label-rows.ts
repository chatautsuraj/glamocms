/** Turn catalog products into printable label rows (one per product, or one per shade). */
import type { PosProduct } from "@/lib/api/types";
import type { LabelItem } from "./labels";

export interface LabelRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variant: string | null;
  code: string;
  sku: string | null;
  price: number;
  stock: number;
  lowStock: boolean;
  imageUrl: string | null;
  category: string | null;
  brand: string | null;
  /** Lower-cased haystack for search. */
  search: string;
}

/** Default number of labels: one per item in stock (at least one). */
export function defaultCopies(stock: number): number {
  return stock > 0 ? Math.floor(stock) : 1;
}

export function labelRowsFor(p: PosProduct): LabelRow[] {
  const shared = { productId: p.id, name: p.name, imageUrl: p.imageUrl ?? null, category: p.category, brand: p.brand };
  const hay = (extra: Array<string | null | undefined>) => [p.name, p.brand, p.category, ...extra].filter(Boolean).join(" ").toLowerCase();
  if (p.variants.length) {
    return p.variants.map((v) => ({
      ...shared,
      key: `${p.id}:${v.id}`,
      variantId: v.id,
      variant: v.name,
      code: (v.barcode || v.sku || "").trim(),
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      lowStock: v.stock <= p.lowStockThreshold,
      search: hay([v.name, v.barcode, v.sku]),
    }));
  }
  return [{
    ...shared,
    key: `${p.id}:`,
    variantId: null,
    variant: p.attributes?.shade || null,
    code: (p.barcode || p.sku || "").trim(),
    sku: p.sku,
    price: p.price,
    stock: p.stock,
    lowStock: p.stock <= p.lowStockThreshold,
    search: hay([p.attributes?.shade, p.barcode, p.sku]),
  }];
}

export function toLabelItem(row: LabelRow, copies: number): LabelItem {
  return { code: row.code, name: row.name, variant: row.variant, price: row.price, sku: row.sku, copies };
}
