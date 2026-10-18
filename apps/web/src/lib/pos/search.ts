/** Product search + category filter for the POS grid (pure, unit tested). */
import type { CachedProduct } from "@/lib/offline/db";

export const ALL_CATEGORIES = "";

/** Categories present in the catalog, most products first. */
export function categoriesOf(products: CachedProduct[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of products) {
    const c = p.category?.trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Filter + rank: exact barcode/SKU first, then names starting with the
 * query, then any word match in name / brand / shade / codes. Every word of
 * the query must match ("fit 128" finds "Fit Me … 128").
 */
export function searchProducts(products: CachedProduct[], query: string, category = ALL_CATEGORIES): CachedProduct[] {
  const inCategory = category ? products.filter((p) => p.category === category) : products;
  const q = query.trim().toLowerCase();
  if (!q) return inCategory;
  const words = q.split(/\s+/);
  const upper = q.toUpperCase();
  const scored: Array<{ p: CachedProduct; score: number }> = [];
  for (const p of inCategory) {
    const hay = `${p.nameLower} ${p.brand?.toLowerCase() ?? ""} ${p.attributes?.shade?.toLowerCase() ?? ""} ${p.variants.map((v) => v.name.toLowerCase()).join(" ")} ${p.codes.join(" ").toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const score = p.codes.includes(upper) ? 0 : p.nameLower.startsWith(q) ? 1 : p.brand?.toLowerCase().startsWith(q) ? 2 : 3;
    scored.push({ p, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.p.nameLower.localeCompare(b.p.nameLower)).map((s) => s.p);
}
