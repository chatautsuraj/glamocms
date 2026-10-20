"use client";

import { memo, useState } from "react";
import { Minus, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import type { CartLine } from "@/lib/pos/cart";
import { digitsToInt, formatNPR } from "@/lib/format";

type Props = {
  line: CartLine;
  /** Managers: line discount + price change. */
  canOverride: boolean;
  /** Increments to replay the "just scanned" flash. */
  flash: number;
  onQty: (key: string, qty: number) => void;
  onBump: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onLineDiscount: (key: string, amount: number) => void;
  onUnitPrice: (key: string, price: number) => void;
};

export const CartLineRow = memo(function CartLineRow({ line: l, canOverride, flash, onQty, onBump, onRemove, onLineDiscount, onUnitPrice }: Props) {
  const lineTotal = l.unitPrice * l.quantity - l.lineDiscount;
  const overStock = l.trackInventory && l.quantity > l.stock;
  const adjusted = l.lineDiscount > 0 || l.unitPrice !== l.listPrice;
  // Price and discount fields stay folded away until a manager asks for them, so a line is one row tall.
  const [adjustOpen, setAdjustOpen] = useState(adjusted);
  const showAdjust = canOverride && (adjustOpen || adjusted);
  return (
    <li className="relative isolate px-3 py-2.5 sm:px-4">
      {/* Re-keyed overlay replays the "just scanned" flash without remounting the inputs; it sits behind the text. */}
      {flash > 0 && <span key={flash} aria-hidden className="pointer-events-none absolute inset-0 -z-10 animate-scan-flash" />}
      <div className="flex items-start gap-3">
        <ProductImage src={l.imageUrl} name={l.name} className="h-11 w-11 shrink-0 border border-border" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{l.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[l.variantName, `${formatNPR(l.unitPrice)} each`].filter(Boolean).join(" · ")}
            {l.unitPrice !== l.listPrice && <span className="text-warning"> · price changed</span>}
          </p>
          {overStock && <p className="text-xs font-semibold text-warning">Only {Math.max(0, l.stock)} in stock</p>}
        </div>
        <p className="tabular shrink-0 text-right text-sm font-bold">
          {formatNPR(lineTotal)}
          {l.lineDiscount > 0 && <span className="block text-[11px] font-medium text-success">−{formatNPR(l.lineDiscount)}</span>}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-14">
        <div className="flex items-center rounded-full border border-input" role="group" aria-label={`Quantity of ${l.name}`}>
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="One less" onClick={() => onBump(l.key, -1)}>
            <Minus className="h-4 w-4" />
          </Button>
          <input
            aria-label="Quantity"
            inputMode="numeric"
            className="tabular h-10 w-10 bg-transparent text-center text-base font-bold focus-visible:outline-none"
            value={l.quantity}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onQty(l.key, digitsToInt(e.target.value) || 1)}
          />
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="One more" onClick={() => onBump(l.key, 1)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {canOverride && !showAdjust && (
          <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" onClick={() => setAdjustOpen(true)} aria-label={`Change price or discount for ${l.name}`}>
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Price
          </Button>
        )}
        {showAdjust && (
          <>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Discount Rs
              <input
                inputMode="numeric"
                className="tabular h-10 w-16 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none"
                value={l.lineDiscount || ""}
                placeholder="0"
                onChange={(e) => onLineDiscount(l.key, digitsToInt(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Price
              <input
                inputMode="numeric"
                className="tabular h-10 w-20 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none"
                value={l.unitPrice}
                onChange={(e) => onUnitPrice(l.key, digitsToInt(e.target.value))}
              />
            </label>
          </>
        )}
        <Button variant="ghost" size="icon" className="ml-auto h-10 w-10 text-muted-foreground hover:text-danger" aria-label={`Remove ${l.name}`} onClick={() => onRemove(l.key)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
});
