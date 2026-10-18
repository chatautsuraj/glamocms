"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, NotebookPen, QrCode, Smartphone, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import { paymentLabel } from "@/lib/labels";
import { REFERENCE_METHODS, summariseTenders, type Tender } from "@/lib/pos/math";

const METHODS: Array<{ method: PaymentMethod; icon: React.ComponentType<{ className?: string }> }> = [
  { method: "CASH", icon: Banknote },
  { method: "FONEPAY_QR", icon: QrCode },
  { method: "KHALTI", icon: Wallet },
  { method: "ESEWA", icon: Smartphone },
  { method: "CARD", icon: CreditCard },
  { method: "BANK_TRANSFER", icon: Landmark },
  { method: "CREDIT", icon: NotebookPen },
];

const ERROR_TEXT: Record<string, string> = {
  INSUFFICIENT_PAYMENT: "Payments don't cover the total yet.",
  NON_CASH_OVERPAYMENT: "Only cash can be over-tendered — reduce the non-cash amount.",
  CREDIT_REQUIRES_CUSTOMER: "Khata needs a named customer with a phone number.",
  REFERENCE_REQUIRED: "Enter the transaction / approval reference for digital & card payments.",
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  hasNamedCustomer: boolean;
  onNeedCustomer: () => void;
  onComplete: (tenders: Tender[]) => Promise<void> | void;
  busy?: boolean;
  /** Phone/delivery orders may leave the balance as cash on delivery. */
  allowShortfall?: boolean;
  title?: string;
};

export function CheckoutDialog({ open, onOpenChange, total, hasNamedCustomer, onNeedCustomer, onComplete, busy, allowShortfall, title = "Take payment" }: Props) {
  const [tenders, setTenders] = useState<Tender[]>([]);

  useEffect(() => {
    if (open) setTenders(allowShortfall ? [] : [{ method: "CASH", amount: total }]);
  }, [open, total, allowShortfall]);

  const summary = useMemo(() => summariseTenders(tenders, total, { allowShortfall, hasNamedCustomer, requireReference: true }), [tenders, total, allowShortfall, hasNamedCustomer]);

  const addMethod = (method: PaymentMethod) => {
    const remaining = Math.max(0, total - tenders.reduce((s, t) => s + t.amount, 0));
    const existing = tenders.findIndex((t) => t.method === method);
    if (tenders.length === 1 && tenders[0].amount === total && remaining === 0 && method !== tenders[0].method) {
      // One full tender → switch method instead of splitting.
      setTenders([{ method, amount: total }]);
      return;
    }
    if (existing >= 0) return;
    setTenders([...tenders, { method, amount: remaining }]);
  };

  const update = (i: number, patch: Partial<Tender>) => setTenders(tenders.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const submit = async () => {
    if (summary.error || busy) return;
    await onComplete(tenders.filter((t) => t.amount > 0));
  };

  const cashIndex = tenders.findIndex((t) => t.method === "CASH");
  const quickCash = [...new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])].filter((v) => v > 0).slice(0, 4);
  const showQr = tenders.some((t) => t.method === "FONEPAY_QR");

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={title} className="max-w-2xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-center text-3xl font-semibold" aria-live="polite">{formatNPR(total)}</p>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Add payment method {tenders.length > 0 && <span className="text-muted-foreground">(add another to split)</span>}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {METHODS.map(({ method, icon: Icon }) => (
                <Button key={method} type="button" variant={tenders.some((t) => t.method === method) ? "default" : "outline"} className="h-14 flex-col gap-1 text-xs" onClick={() => addMethod(method)} aria-pressed={tenders.some((t) => t.method === method)}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {paymentLabel(method)}
                </Button>
              ))}
            </div>
          </fieldset>

          <ul className="space-y-2" aria-label="Tenders">
            {tenders.map((t, i) => (
              <li key={t.method} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border p-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-center">
                <span className="text-sm font-medium">{paymentLabel(t.method)}</span>
                <label className="sm:order-none">
                  <span className="sr-only">{paymentLabel(t.method)} amount</span>
                  <Input
                    inputMode="numeric"
                    value={t.amount || ""}
                    placeholder="Amount"
                    onChange={(e) => update(i, { amount: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    className="h-11 text-base"
                    aria-label={`${paymentLabel(t.method)} amount`}
                  />
                </label>
                {REFERENCE_METHODS.includes(t.method) ? (
                  <Input value={t.reference ?? ""} onChange={(e) => update(i, { reference: e.target.value })} placeholder="Reference / approval no." className="h-11" aria-label={`${paymentLabel(t.method)} reference`} />
                ) : t.method === "CREDIT" ? (
                  <span className="text-xs text-muted-foreground">{hasNamedCustomer ? "Charged to customer khata" : <button type="button" className="text-primary underline" onClick={onNeedCustomer}>Add customer</button>}</span>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${paymentLabel(t.method)}`} onClick={() => setTenders(tenders.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>

          {cashIndex >= 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick cash amounts">
              <span className="text-xs text-muted-foreground">Cash tendered:</span>
              {quickCash.map((v) => (
                <Button key={v} type="button" size="sm" variant="secondary" className="min-h-10" onClick={() => {
                  const others = tenders.filter((_, j) => j !== cashIndex).reduce((s, t) => s + t.amount, 0);
                  update(cashIndex, { amount: Math.max(v - others, 0) });
                }}>
                  {formatNPR(v)}
                </Button>
              ))}
            </div>
          )}

          {showQr && (
            <div className="flex items-center gap-4 rounded-xl border border-border p-3">
              <Image src="/fonepay-qr.jpg" alt="GLAMO Fonepay QR code" width={120} height={120} className="h-28 w-28 rounded-lg object-contain" />
              <p className="text-sm text-muted-foreground">Ask the customer to scan, then enter the Fonepay reference shown on their app.</p>
            </div>
          )}

          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center text-sm">
            <div><dt className="text-xs text-muted-foreground">Tendered</dt><dd className="font-semibold">{formatNPR(summary.tendered)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{allowShortfall ? "Due on delivery" : "Remaining"}</dt><dd className="font-semibold">{formatNPR(allowShortfall ? summary.due : summary.remaining)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Change</dt><dd className="text-lg font-semibold text-success" aria-live="polite">{formatNPR(summary.change)}</dd></div>
          </dl>

          {summary.error && <p role="alert" className="text-sm text-danger">{ERROR_TEXT[summary.error]}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Back</Button>
            <Button type="submit" size="lg" variant="success" disabled={Boolean(summary.error) || busy} aria-busy={busy}>
              {busy ? "Saving…" : "Complete sale"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
