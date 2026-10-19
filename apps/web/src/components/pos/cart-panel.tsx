"use client";

import { useState } from "react";
import { Percent, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/lib/api/types";
import type { CartCustomer, CartLine } from "@/lib/pos/cart";
import type { VatConfig } from "@/lib/pos/config-store";
import { digitsToInt, formatNPR } from "@/lib/format";
import type { CartTotals } from "@/lib/pos/math";
import { paymentTitle } from "@/lib/pos/payments";
import { CartLineRow } from "./cart-line";
import { CustomerChip } from "./customer-chip";
import { METHOD_ICON } from "./payment-icons";
import { Totals } from "./totals";

export type CartActions = {
  setQty: (key: string, qty: number) => void;
  bumpQty: (key: string, delta: number) => void;
  remove: (key: string) => void;
  setLineDiscount: (key: string, amount: number) => void;
  setUnitPrice: (key: string, price: number) => void;
  setDiscount: (amount: number) => void;
  setCustomer: (c: CartCustomer | null) => void;
};

type Props = {
  lines: CartLine[];
  lastKey: string | null;
  addSeq: number;
  totals: CartTotals;
  vat: VatConfig;
  discount: number;
  customer: CartCustomer | null;
  canOverride: boolean;
  /** Discount above the cashier limit (needs a manager). */
  discountProblem: string | null;
  customerRequired: boolean;
  methods: PaymentMethod[];
  actions: CartActions;
  onClear: () => void;
  onCharge: (method: PaymentMethod) => void;
};

/** Right-hand side of the POS: lines, totals, payment buttons and the big Charge button. */
export function CartPanel({ lines, lastKey, addSeq, totals, vat, discount, customer, canOverride, discountProblem, customerRequired, methods, actions, onClear, onCharge }: Props) {
  const [showDiscount, setShowDiscount] = useState(false);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const needsCustomer = customerRequired && !(customer?.phone || customer?.id);
  const blocked = !lines.length || Boolean(discountProblem) || needsCustomer;

  return (
    <section aria-label="Current sale" className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Current sale {itemCount > 0 && <span className="font-normal text-muted-foreground">· {itemCount} {itemCount === 1 ? "item" : "items"}</span>}</h2>
          <CustomerChip customer={customer} onChange={actions.setCustomer} required={customerRequired} />
        </div>
        <Button variant="ghost" size="icon" aria-label="Clear sale" onClick={onClear} disabled={!lines.length}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {lines.length ? (
          <ul className="divide-y divide-border" aria-label="Items in this sale">
            {lines.map((l) => (
              <CartLineRow
                key={l.key}
                line={l}
                canOverride={canOverride}
                flash={l.key === lastKey ? addSeq : 0}
                onQty={actions.setQty}
                onBump={actions.bumpQty}
                onRemove={actions.remove}
                onLineDiscount={actions.setLineDiscount}
                onUnitPrice={actions.setUnitPrice}
              />
            ))}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <ScanLine className="h-10 w-10 text-rose" aria-hidden />
            <p className="font-semibold">Scan a barcode to start</p>
            <p className="text-sm text-muted-foreground">Or choose a product from the catalog.</p>
          </div>
        )}
      </div>

      <footer className="space-y-3 border-t border-border p-3 sm:p-4">
        {lines.length > 0 && (
          showDiscount || discount > 0 ? (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <Percent className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span>Bill discount Rs</span>
              <input
                inputMode="numeric"
                autoFocus={showDiscount && discount === 0}
                className="tabular h-11 w-24 rounded-md border border-input bg-card px-2 text-base md:text-sm focus-visible:border-ring focus-visible:outline-none"
                value={discount || ""}
                placeholder="0"
                onChange={(e) => actions.setDiscount(digitsToInt(e.target.value))}
                aria-invalid={Boolean(discountProblem)}
              />
              {discountProblem && <span role="alert" className="w-full text-xs font-medium text-danger">{discountProblem}</span>}
            </label>
          ) : (
            <Button variant="link" size="sm" className="min-h-11" onClick={() => setShowDiscount(true)}>
              <Percent className="h-3.5 w-3.5" aria-hidden /> Add discount
            </Button>
          )
        )}
        <Totals subtotal={totals.subtotal} discount={totals.discount} vatAmount={totals.vatAmount} vat={vat} total={totals.total} />
        {needsCustomer && lines.length > 0 && <p className="text-xs font-medium text-warning">Add the customer&apos;s phone to finish this sale.</p>}
        {methods.length > 1 && (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pay with">
            {methods.map((m) => {
              const Icon = METHOD_ICON[m];
              return (
                <Button key={m} variant="outline" className="h-12 rounded-xl px-2 text-xs" onClick={() => onCharge(m)} disabled={blocked}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{paymentTitle(m)}</span>
                </Button>
              );
            })}
          </div>
        )}
        <Button variant="brand" size="xl" className="w-full min-w-0 gap-2 px-3 text-lg" onClick={() => onCharge("CASH")} disabled={blocked}>
          Charge {formatNPR(totals.total)}
          <kbd className="ml-1 hidden rounded border border-brand-foreground/30 px-1.5 text-xs font-medium sm:inline">F4</kbd>
        </Button>
      </footer>
    </section>
  );
}
