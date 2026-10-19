"use client";

import { Plus, Check } from "lucide-react";
import { memo } from "react";
import { ProductImage } from "@/components/product-image";
import type { CachedProduct } from "@/lib/offline/db";
import { formatNPR } from "@/lib/format";
import { expiryState } from "@/lib/pos/sellable";
import { cn } from "@/lib/utils";

export function stockLabel(p: Pick<CachedProduct, "stock" | "lowStockThreshold" | "trackInventory">): { text: string; tone: "ok" | "low" | "out" } {
  if (p.trackInventory === false) return { text: "In stock", tone: "ok" };
  if (p.stock <= 0) return { text: "Out of stock", tone: "out" };
  if (p.stock <= p.lowStockThreshold) return { text: `Only ${p.stock} left`, tone: "low" };
  return { text: `${p.stock} in stock`, tone: "ok" };
}

const TONE = {
  ok: "text-muted-foreground",
  low: "text-warning font-semibold",
  out: "text-danger font-semibold",
} as const;

/** Big photo tile: tap = add one (or choose a shade). Memoised — only re-renders when its own data changes. */
export const ProductTile = memo(function ProductTile({ product, inCart, onPick }: { product: CachedProduct; inCart: number; onPick: (p: CachedProduct) => void }) {
  const stock = stockLabel(product);
  const exp = expiryState(product.attributes?.expiry);
  const shades = product.variants.length;
  const fromPrice = shades ? Math.min(...product.variants.map((v) => v.price)) : product.price;
  return (
    <button
      type="button"
      onClick={() => onPick(product)}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-left transition-[border-color,box-shadow] hover:border-rose hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        inCart > 0 ? "border-rose" : "border-border",
      )}
      aria-label={`${product.name}${shades ? `, ${shades} shades` : ""}, ${formatNPR(fromPrice)}, ${stock.text}${inCart ? `, ${inCart} in sale` : ""}`}
    >
      <ProductImage src={product.imageUrl} name={product.name} rounded="rounded-none" className="aspect-square w-full border-b border-border" />
      {inCart > 0 && (
        <span aria-hidden className="absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand px-2 text-sm font-bold text-brand-foreground shadow-card">
          {inCart}
        </span>
      )}
      {(exp === "expired" || exp === "soon" || product.attributes?.tester) && (
        <span aria-hidden className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold", exp === "expired" ? "bg-danger text-danger-foreground" : "bg-warning text-warning-foreground")}>
          {exp === "expired" ? "Expired" : exp === "soon" ? "Expires soon" : "Tester"}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <span className="min-h-[2.5em] break-words text-sm font-semibold leading-snug">{product.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {[product.brand, shades ? `${shades} shades` : product.attributes?.shade].filter(Boolean).join(" · ") || " "}
        </span>
        <span className="mt-auto flex flex-col gap-1 pt-1">
          <span className="tabular break-words text-base font-bold">{shades ? <span className="text-xs font-medium text-muted-foreground">from </span> : null}{formatNPR(fromPrice)}</span>
          <span className={cn("text-xs leading-snug", TONE[stock.tone])}>{stock.text}</span>
        </span>
        <span aria-hidden className="mt-1 flex min-h-11 items-center justify-between gap-2 border-t border-border pt-2 text-xs font-semibold text-primary">
          <span>{shades ? "Choose shade" : "Add to sale"}</span>
          {inCart > 0 ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
        </span>
      </span>
    </button>
  );
});
