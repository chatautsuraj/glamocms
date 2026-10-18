import type { PosProduct } from "@/lib/api/types";
import { kathmanduDay } from "./math";

/** Expiry (YYYY-MM-DD or YYYY-MM) → state; cosmetics past expiry must not be sold. */
export function expiryState(expiry: string | undefined, today = kathmanduDay()): "none" | "ok" | "soon" | "expired" {
  if (!expiry) return "none";
  const iso = /^\d{4}-\d{2}$/.test(expiry) ? `${expiry}-28` : expiry.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "none";
  if (iso < today) return "expired";
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);
  return iso <= soon.toISOString().slice(0, 10) ? "soon" : "ok";
}

export function stockOf(p: PosProduct, variantId: string | null) {
  if (variantId) return p.variants.find((v) => v.id === variantId)?.stock ?? 0;
  return p.stock;
}

/**
 * Can `qty` more of this product be added to a cart already holding `inCart`?
 * Returns an error (block) or a warning (allow, but tell the cashier).
 */
export function sellCheck(p: PosProduct, variantId: string | null, inCart: number, opts: { allowNegativeStock?: boolean; online?: boolean } = {}): { error?: string; warning?: string } {
  if (!p.isActive) return { error: `${p.name} is inactive.` };
  if (p.variants.length > 0 && !variantId) return { error: "Choose a shade / variant first." };
  const exp = expiryState(p.attributes?.expiry);
  if (exp === "expired") return { error: `${p.name} is past its expiry date (${p.attributes.expiry}). Remove it from the shelf.` };
  const stock = stockOf(p, variantId);
  if ((p.trackInventory ?? true) && inCart + 1 > stock) {
    if (opts.allowNegativeStock) return { warning: `Only ${Math.max(0, stock)} in stock — selling below zero.` };
    if (opts.online === false) return { warning: `Cached stock shows ${Math.max(0, stock)}. Sale will be checked when it syncs.` };
    return { error: `Only ${Math.max(0, stock)} of ${p.name} in stock.` };
  }
  if (p.attributes?.tester) return { warning: "This is a tester item." };
  if (exp === "soon") return { warning: `Expires soon (${p.attributes.expiry}).` };
  return {};
}
