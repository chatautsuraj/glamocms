/** Local catalog cache: full snapshot, then deltas via meta.serverTime. */
import { catalogApi } from "@/lib/api/catalog";
import type { PosProduct } from "@/lib/api/types";
import { db, getMeta, setMeta, toCached, type CachedProduct } from "./db";

const CURSOR = "catalogServerTime";

type SnapshotFn = (updatedSince?: string) => Promise<{ products: PosProduct[]; serverTime: string | null }>;

/**
 * Pull the catalog. First run (or `full`) replaces the cache; afterwards only
 * products changed since the last serverTime are fetched, and `deleted:true`
 * rows are removed. Pending offline sales are re-applied to stock afterwards
 * so the POS never shows stock that has already been sold locally.
 */
export async function refreshCatalog(opts: { full?: boolean; snapshot?: SnapshotFn } = {}) {
  const snapshot = opts.snapshot ?? catalogApi.snapshot;
  const since = opts.full ? undefined : await getMeta<string>(CURSOR);
  const { products, serverTime } = await snapshot(since);
  const table = db().products;
  await db().transaction("rw", table, db().meta, async () => {
    if (!since) await table.clear();
    const live = products.filter((p) => !p.deleted);
    const gone = products.filter((p) => p.deleted).map((p) => p.id);
    if (gone.length) await table.bulkDelete(gone);
    if (live.length) await table.bulkPut(live.map(toCached));
    if (serverTime) await setMeta(CURSOR, serverTime);
  });
  await reapplyPendingStock(since ? new Set(products.map((p) => p.id)) : undefined);
  return { count: products.length, full: !since, serverTime };
}

/** Subtract quantities of still-queued sales from cached stock (optionally only for some products). */
export async function reapplyPendingStock(only?: Set<string>) {
  const pending = await db().pendingSales.toArray();
  for (const sale of pending) {
    for (const item of sale.payload.items) {
      if (only && !only.has(item.productId)) continue;
      await decrementLocalStock(item.productId, item.variantId ?? null, item.quantity);
    }
  }
}

export async function decrementLocalStock(productId: string, variantId: string | null, qty: number) {
  const table = db().products;
  const p = await table.get(productId);
  if (!p) return;
  const variants = p.variants.map((v) => (v.id === variantId ? { ...v, stock: v.stock - qty } : v));
  const stock = variants.length && variantId ? variants.reduce((s, v) => s + v.stock, 0) : p.stock - qty;
  await table.put({ ...p, variants, stock });
}

export async function cachedProducts(): Promise<CachedProduct[]> {
  return db().products.orderBy("nameLower").toArray();
}

/** Scanner lookup in the local cache (barcode / SKU of product or variant). */
export async function findCachedByCode(code: string): Promise<{ product: CachedProduct; variantId: string | null } | null> {
  const needle = code.trim().toUpperCase();
  if (!needle) return null;
  const product = await db().products.where("codes").equals(needle).first();
  if (!product) return null;
  const variant = product.variants.find((v) => v.barcode?.toUpperCase() === needle || v.sku?.toUpperCase() === needle);
  return { product, variantId: variant?.id ?? null };
}

export async function upsertCachedProduct(p: PosProduct) {
  if (p.deleted) await db().products.delete(p.id);
  else await db().products.put(toCached(p));
}
