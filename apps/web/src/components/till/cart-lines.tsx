"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CartLine } from "@/lib/pos/cart";
import { formatNPR } from "@/lib/format";

type Props = {
  lines: CartLine[];
  canOverride: boolean;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onLineDiscount: (key: string, amount: number) => void;
  onUnitPrice: (key: string, price: number) => void;
};

export function CartLines({ lines, canOverride, onQty, onRemove, onLineDiscount, onUnitPrice }: Props) {
  if (!lines.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty — scan a barcode or pick a product.</p>;
  }
  return (
    <ul className="divide-y divide-border" aria-label="Cart">
      {lines.map((l) => (
        <li key={l.key} className="space-y-2 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">
                {[l.variantName, l.sku].filter(Boolean).join(" · ")}
                {!l.vatApplicable && " · VAT exempt"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold">{formatNPR(l.unitPrice * l.quantity - l.lineDiscount)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-border" role="group" aria-label={`Quantity of ${l.name}`}>
              <Button variant="ghost" size="icon" aria-label="Decrease quantity" onClick={() => (l.quantity <= 1 ? onRemove(l.key) : onQty(l.key, l.quantity - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                aria-label="Quantity"
                inputMode="numeric"
                className="h-10 w-12 border-0 text-center shadow-none"
                value={l.quantity}
                onChange={(e) => onQty(l.key, Number(e.target.value.replace(/\D/g, "")) || 1)}
              />
              <Button variant="ghost" size="icon" aria-label="Increase quantity" onClick={() => onQty(l.key, l.quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Disc. Rs
              <Input
                inputMode="numeric"
                className="h-10 w-20"
                value={l.lineDiscount || ""}
                placeholder="0"
                onChange={(e) => onLineDiscount(l.key, Number(e.target.value.replace(/\D/g, "")) || 0)}
              />
            </label>
            {canOverride ? (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Price
                <Input
                  inputMode="numeric"
                  className="h-10 w-24"
                  value={l.unitPrice}
                  onChange={(e) => onUnitPrice(l.key, Number(e.target.value.replace(/\D/g, "")) || 0)}
                />
              </label>
            ) : (
              <span className="text-xs text-muted-foreground">@ {formatNPR(l.unitPrice)}</span>
            )}
            <Button variant="ghost" size="icon" className="ml-auto text-danger" aria-label={`Remove ${l.name}`} onClick={() => onRemove(l.key)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TotalsBlock({ subtotal, discount, vatAmount, vatRate, deliveryCharge = 0, total }: { subtotal: number; discount: number; vatAmount: number; vatRate: number; deliveryCharge?: number; total: number }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatNPR(subtotal)}</dd></div>
      {discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>− {formatNPR(discount)}</dd></div>}
      {deliveryCharge > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{formatNPR(deliveryCharge)}</dd></div>}
      <div className="flex justify-between text-xs"><dt className="text-muted-foreground">Incl. VAT {vatRate}%</dt><dd>{formatNPR(vatAmount)}</dd></div>
      <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold"><dt>Total</dt><dd aria-live="polite">{formatNPR(total)}</dd></div>
    </dl>
  );
}
