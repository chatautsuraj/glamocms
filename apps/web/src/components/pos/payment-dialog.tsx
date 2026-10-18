"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, QrCode, Split, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PaymentMethod, PaymentSettings } from "@/lib/api/types";
import { digitsToInt, formatNPR } from "@/lib/format";
import { quickCashAmounts, summariseTenders, type Tender } from "@/lib/pos/math";
import { isScreenMethod, paymentAccount, paymentTitle } from "@/lib/pos/payments";
import { cn } from "@/lib/utils";
import { METHOD_ICON } from "./payment-icons";
import { PaymentScreen } from "./payment-screen";

type SplitRow = { method: PaymentMethod; amount: string; reference: string; confirmed: boolean };
type ScreenTarget = { method: PaymentMethod; amount: number; row: number | null };

const ERROR_TEXT: Record<string, string> = {
  INSUFFICIENT_PAYMENT: "The payments don't cover the total yet.",
  NON_CASH_OVERPAYMENT: "Only cash can be more than the total. Lower the other amounts.",
  REFERENCE_REQUIRED: "Add the reference number.",
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  /** Enabled payment methods (Settings → Payments). */
  methods: PaymentMethod[];
  initialMethod: PaymentMethod;
  payments: PaymentSettings | null;
  onComplete: (tenders: Tender[]) => Promise<void> | void;
  busy?: boolean;
  /** Phone / delivery orders may leave the rest as cash on delivery. */
  allowShortfall?: boolean;
  title?: string;
  /** Show "add the QR in Settings" to managers. */
  settingsHint: boolean;
};

/**
 * Take payment. Cash: amount received + quick buttons + change. Fonepay /
 * eSewa / Khalti / bank: the large customer-facing QR screen. Card: optional
 * approval code. "Split payment" combines any enabled methods.
 */
export function PaymentDialog({ open, onOpenChange, total, methods, initialMethod, payments, onComplete, busy, allowShortfall, title = "Take payment", settingsHint }: Props) {
  const [mode, setMode] = useState<"single" | "split">("single");
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [cash, setCash] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [screen, setScreen] = useState<ScreenTarget | null>(null);
  const cashRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const start = methods.includes(initialMethod) ? initialMethod : methods[0] ?? "CASH";
    setMode("single");
    setMethod(start);
    setCash("");
    setPaidNow(allowShortfall ? String(total) : "");
    setReference("");
    setRows([]);
    setScreen(isScreenMethod(start) && !allowShortfall ? { method: start, amount: total, row: null } : null);
  }, [open, initialMethod, methods, total, allowShortfall]);

  const cashGiven = cash.trim() === "" ? total : digitsToInt(cash);
  const singleAmount = allowShortfall ? digitsToInt(paidNow) : method === "CASH" ? cashGiven : total;
  const singleTenders: Tender[] = useMemo(() => (singleAmount > 0 ? [{ method, amount: singleAmount, reference: reference.trim() || undefined }] : []), [method, singleAmount, reference]);
  const splitTenders: Tender[] = useMemo(() => rows.map((r) => ({ method: r.method, amount: digitsToInt(r.amount), reference: r.reference.trim() || undefined })), [rows]);
  const tenders = mode === "split" ? splitTenders : singleTenders;
  const summary = useMemo(() => summariseTenders(tenders, total, { allowShortfall }), [tenders, total, allowShortfall]);
  // A barcode or an extra zero typed into "cash received" must not become a huge change.
  const cashTooHigh = mode === "single" && method === "CASH" && !allowShortfall && cashGiven > total + Math.max(10_000, total * 2);

  const complete = async (list: Tender[] = tenders) => {
    if (busy || (list === tenders && cashTooHigh)) return;
    const check = summariseTenders(list, total, { allowShortfall });
    if (check.error) return;
    await onComplete(list.filter((t) => t.amount > 0));
  };

  const chooseMethod = (m: PaymentMethod) => {
    setMethod(m);
    setReference("");
    if (isScreenMethod(m) && !allowShortfall) setScreen({ method: m, amount: total, row: null });
    else if (m === "CASH") window.setTimeout(() => cashRef.current?.focus(), 0);
  };

  const startSplit = () => {
    const second = methods.find((m) => m !== method) ?? method;
    const firstAmount = method === "CASH" && cash.trim() ? Math.min(cashGiven, total) : Math.ceil(total / 2);
    setRows([
      { method, amount: String(firstAmount), reference: "", confirmed: false },
      { method: second, amount: String(Math.max(0, total - firstAmount)), reference: "", confirmed: false },
    ]);
    setMode("split");
  };

  const updateRow = (i: number, patch: Partial<SplitRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remainingForNew = Math.max(0, total - splitTenders.reduce((s, t) => s + t.amount, 0));

  const screenAccount = screen ? paymentAccount(screen.method, payments) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={title} className={screen ? "max-w-5xl" : "max-w-2xl"}>
      <DialogContent onClose={() => onOpenChange(false)}>
        {screen && screenAccount ? (
          <>
            <DialogHeader><DialogTitle>{screenAccount.title} payment</DialogTitle></DialogHeader>
            <PaymentScreen
              account={screenAccount}
              amount={screen.amount}
              reference={screen.row === null ? reference : rows[screen.row]?.reference ?? ""}
              onReference={(v) => (screen.row === null ? setReference(v) : updateRow(screen.row, { reference: v }))}
              busy={busy}
              settingsHint={settingsHint}
              onBack={() => setScreen(null)}
              onReceived={() => {
                if (screen.row === null) {
                  void complete([{ method: screen.method, amount: screen.amount, reference: reference.trim() || undefined }]);
                } else {
                  updateRow(screen.row, { confirmed: true });
                  setScreen(null);
                }
              }}
            />
          </>
        ) : (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void complete(); }}>
            <DialogHeader className="space-y-0">
              <DialogTitle>{title}</DialogTitle>
              <p className="tabular font-display text-5xl font-bold leading-tight" aria-live="polite">{formatNPR(total)}</p>
            </DialogHeader>

            {mode === "single" ? (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Pay with</legend>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {methods.map((m) => {
                      const Icon = METHOD_ICON[m];
                      const active = m === method;
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={active}
                          onClick={() => chooseMethod(m)}
                          className={cn(
                            "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-rose bg-rose-tint" : "border-border bg-card hover:border-rose",
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                          {paymentTitle(m)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {allowShortfall && (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Paid now with {paymentTitle(method)} (Rs)</span>
                    <Input inputMode="numeric" value={paidNow} onChange={(e) => setPaidNow(e.target.value.replace(/\D/g, ""))} className="tabular h-14 text-2xl font-bold" />
                    <span className="block text-xs text-muted-foreground">The rest is collected on delivery.</span>
                  </label>
                )}

                {method === "CASH" && !allowShortfall && (
                  <div className="space-y-3">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">Cash received (Rs)</span>
                      <Input
                        ref={cashRef}
                        inputMode="numeric"
                        value={cash}
                        onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
                        placeholder={String(total)}
                        className="tabular h-14 text-2xl font-bold"
                        autoFocus
                        data-autofocus
                        aria-invalid={cashTooHigh}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick cash amounts">
                      {quickCashAmounts(total).map((v, i) => (
                        <Button key={v} variant={cashGiven === v ? "default" : "outline"} className="tabular min-w-24" onClick={() => setCash(String(v))}>
                          {i === 0 ? `Exact ${formatNPR(v)}` : formatNPR(v)}
                        </Button>
                      ))}
                    </div>
                    <div className={cn("flex items-baseline justify-between rounded-xl px-4 py-3", summary.change > 0 ? "bg-success/10" : "bg-muted")}>
                      <span className="text-sm font-semibold">{summary.remaining > 0 ? "Still to pay" : "Change to give"}</span>
                      <span className={cn("tabular font-display text-4xl font-bold", summary.remaining > 0 ? "text-danger" : summary.change > 0 ? "text-success" : "")} aria-live="polite">
                        {formatNPR(summary.remaining > 0 ? summary.remaining : summary.change)}
                      </span>
                    </div>
                  </div>
                )}

                {method !== "CASH" && (isScreenMethod(method) ? !allowShortfall : true) && (
                  <div className="space-y-3">
                    {isScreenMethod(method) && (
                      <Button variant="outline" size="lg" className="w-full" onClick={() => setScreen({ method, amount: total, row: null })}>
                        <QrCode className="h-5 w-5" aria-hidden /> Show {paymentTitle(method)} payment screen
                      </Button>
                    )}
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">{method === "CARD" ? "Approval code" : "Reference"} <span className="font-normal text-muted-foreground">(optional)</span></span>
                      <Input value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
                    </label>
                  </div>
                )}

                {methods.length > 1 && (
                  <Button variant="link" className="h-auto" onClick={startSplit}>
                    <Split className="h-4 w-4" aria-hidden /> Split payment (e.g. part cash, part eSewa)
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-2" aria-label="Payment parts">
                  {rows.map((r, i) => (
                    <li key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border p-3 sm:grid-cols-[150px_1fr_auto]">
                      <Select aria-label={`Method ${i + 1}`} value={r.method} onChange={(e) => updateRow(i, { method: e.target.value as PaymentMethod, confirmed: false })}>
                        {methods.map((m) => <option key={m} value={m}>{paymentTitle(m)}</option>)}
                      </Select>
                      <Input aria-label={`${paymentTitle(r.method)} amount`} inputMode="numeric" value={r.amount} onChange={(e) => updateRow(i, { amount: e.target.value.replace(/\D/g, ""), confirmed: false })} className="tabular order-3 col-span-2 text-lg font-bold sm:order-none sm:col-span-1" placeholder="Amount" />
                      <Button variant="ghost" size="icon" aria-label={`Remove ${paymentTitle(r.method)}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} disabled={rows.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {r.method !== "CASH" && (
                        <div className="order-4 col-span-full flex flex-wrap items-center gap-2">
                          {isScreenMethod(r.method) && (
                            <Button size="sm" variant={r.confirmed ? "success" : "outline"} onClick={() => setScreen({ method: r.method, amount: digitsToInt(r.amount), row: i })} disabled={!digitsToInt(r.amount)}>
                              <QrCode className="h-4 w-4" aria-hidden /> {r.confirmed ? "Received" : "Show QR"}
                            </Button>
                          )}
                          <Input aria-label={`${paymentTitle(r.method)} reference (optional)`} value={r.reference} onChange={(e) => updateRow(i, { reference: e.target.value })} placeholder="Reference (optional)" className="h-9 min-w-0 flex-1" />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { method: methods.find((m) => !rs.some((x) => x.method === m)) ?? "CASH", amount: String(remainingForNew), reference: "", confirmed: false }])}>
                    <Plus className="h-4 w-4" aria-hidden /> Add another method
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMode("single")}>Back to one method</Button>
                </div>
                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center text-sm">
                  <div><dt className="text-xs text-muted-foreground">Received</dt><dd className="tabular font-bold">{formatNPR(summary.tendered)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{allowShortfall ? "Due on delivery" : "Still to pay"}</dt><dd className={cn("tabular font-bold", summary.remaining > 0 && !allowShortfall && "text-danger")}>{formatNPR(allowShortfall ? summary.due : summary.remaining)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Change</dt><dd className="tabular text-lg font-bold text-success" aria-live="polite">{formatNPR(summary.change)}</dd></div>
                </dl>
              </div>
            )}

            {cashTooHigh && <p role="alert" className="text-sm font-medium text-danger">Check the cash amount: {formatNPR(cashGiven)} is much more than the total.</p>}
            {summary.error && (mode === "split" || tenders.length > 0) && <p role="alert" className="text-sm font-medium text-danger">{ERROR_TEXT[summary.error]}</p>}

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Back</Button>
              <Button type="submit" variant="brand" size="xl" disabled={Boolean(summary.error) || cashTooHigh || busy} aria-busy={busy}>
                {busy ? "Saving…" : method === "CARD" && mode === "single" ? "Card payment received" : allowShortfall && summary.due > 0 ? `Place order · ${formatNPR(summary.due)} on delivery` : "Complete sale"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
