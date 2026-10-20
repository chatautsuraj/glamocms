import { formatNPR } from "@/lib/format";
import type { VatConfig } from "@/lib/pos/config-store";
import { cn } from "@/lib/utils";

/** Subtotal · discount · delivery · VAT (only when VAT is on) · big total. */
export function Totals({ subtotal, discount, deliveryCharge = 0, vatAmount, vat, total, className }: {
  subtotal: number;
  discount: number;
  deliveryCharge?: number;
  vatAmount: number;
  vat: VatConfig;
  total: number;
  className?: string;
}) {
  return (
    <dl className={cn("space-y-1 text-sm", className)}>
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{formatNPR(subtotal)}</dd></div>
      {discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular text-success">−{formatNPR(discount)}</dd></div>}
      {deliveryCharge > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="tabular">{formatNPR(deliveryCharge)}</dd></div>}
      {vat.enabled && (
        <div className="flex justify-between text-xs"><dt className="text-muted-foreground">Includes VAT {vat.rate}%</dt><dd className="tabular text-muted-foreground">{formatNPR(vatAmount)}</dd></div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="money text-4xl leading-none" aria-live="polite">{formatNPR(total)}</dd>
      </div>
    </dl>
  );
}
