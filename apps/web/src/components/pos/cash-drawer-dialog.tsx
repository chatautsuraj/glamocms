"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cashDrawerApi } from "@/lib/api/cash-drawer";
import type { DrawerShift } from "@/lib/api/types";
import { digitsToInt, formatDateTime, formatNPR } from "@/lib/format";
import { paymentTitle } from "@/lib/pos/payments";
import { describeDrawerDifference, drawerDifference } from "@/lib/pos/math";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const NOTES = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

/**
 * Optional cash drawer check. Selling never needs it.
 *  - "Cash in drawer when you start" (POST /pos/till/open)
 *  - "Count cash at end of day" → what should be there vs what you counted (POST /pos/till/close)
 */
export function CashDrawerDialog({ open, onOpenChange, drawer, onChange }: { open: boolean; onOpenChange: (o: boolean) => void; drawer: DrawerShift | null; onChange: (d: DrawerShift | null) => void }) {
  const [live, setLive] = useState<DrawerShift | null>(drawer);
  const [result, setResult] = useState<DrawerShift | null>(null);
  const drawerRef = useRef(drawer);
  drawerRef.current = drawer;
  // Reset only when the dialog opens (saving the count clears `drawer`; the result must stay on screen).
  useEffect(() => {
    if (!open) return;
    const current = drawerRef.current;
    setResult(null);
    setLive(current);
    if (current) cashDrawerApi.current().then((d) => d && setLive(d)).catch(() => undefined);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Cash drawer" className="max-w-xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Cash drawer</DialogTitle>
          <DialogDescription>Optional. Helps you check the cash at the end of the day. You can sell without it.</DialogDescription>
        </DialogHeader>
        {result ? (
          <DayResult shift={result} onDone={() => onOpenChange(false)} />
        ) : live ? (
          <CountForm shift={live} onClosed={(s) => { setResult(s); onChange(null); }} />
        ) : (
          <StartForm onStarted={(s) => { onChange(s); toast.success("Starting cash saved"); onOpenChange(false); }} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StartForm({ onStarted }: { onStarted: (s: DrawerShift) => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      onStarted(await cashDrawerApi.start(digitsToInt(amount)));
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <Field label="Cash in drawer when you start (Rs)" hint="Count the notes and coins in the drawer now. Enter 0 if it is empty.">
        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" className="tabular h-14 text-2xl font-bold" autoFocus />
      </Field>
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save starting cash"}</Button>
    </form>
  );
}

function CountForm({ shift, onClosed }: { shift: DrawerShift; onClosed: (s: DrawerShift) => void }) {
  const [counted, setCounted] = useState("");
  const [byNote, setByNote] = useState<Record<number, string>>({});
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const noteTotal = useMemo(() => NOTES.reduce((s, n) => s + n * digitsToInt(byNote[n] ?? ""), 0), [byNote]);
  const countedCash = counted.trim() ? digitsToInt(counted) : noteTotal;
  const hasCount = counted.trim() !== "" || noteTotal > 0;
  const diff = drawerDifference(shift.expectedCash, countedCash);

  const submit = async () => {
    setBusy(true);
    try {
      onClosed(await cashDrawerApi.count(countedCash, notes));
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <dl className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Cash when you started{shift.openedAt ? ` (${formatDateTime(shift.openedAt)})` : ""}</dt><dd className="tabular">{formatNPR(shift.openingFloat)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Cash taken from sales</dt><dd className="tabular">+ {formatNPR(shift.cashSales)}</dd></div>
        {shift.totals.refunds > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Refunds</dt><dd className="tabular">{formatNPR(shift.totals.refunds)}</dd></div>}
        <div className="flex justify-between border-t border-border pt-2 text-base"><dt className="font-semibold">Cash that should be in the drawer</dt><dd className="tabular font-bold">{formatNPR(shift.expectedCash)}</dd></div>
      </dl>
      <Field label="Count cash at end of day (Rs)" hint={noteTotal ? `Notes and coins add up to ${formatNPR(noteTotal)}` : "Count all the cash in the drawer and type the total."}>
        <Input inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} placeholder={noteTotal ? String(noteTotal) : "0"} className="tabular h-14 text-2xl font-bold" autoFocus />
      </Field>
      <button type="button" className="flex min-h-11 items-center gap-1 text-sm font-medium text-primary" aria-expanded={showNotes} onClick={() => setShowNotes((v) => !v)}>
        <ChevronDown className={cn("h-4 w-4 transition-transform", showNotes && "rotate-180")} aria-hidden /> Count note by note
      </button>
      {showNotes && (
        <fieldset className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <legend className="sr-only">Number of each note and coin</legend>
          {NOTES.map((n) => (
            <label key={n} className="text-xs">
              <span className="mb-1 block text-muted-foreground">Rs {n} ×</span>
              <Input inputMode="numeric" value={byNote[n] ?? ""} onChange={(e) => setByNote({ ...byNote, [n]: e.target.value.replace(/\D/g, "") })} aria-label={`Number of Rs ${n}`} />
            </label>
          ))}
        </fieldset>
      )}
      {hasCount && (
        <p role="status" className={cn("rounded-xl px-4 py-3 text-center text-lg font-semibold", diff === 0 ? "bg-success/10 text-success" : diff < 0 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
          {describeDrawerDifference(diff, formatNPR)}
        </p>
      )}
      <Field label="Note (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="For example: Rs 500 taken out for supplies" /></Field>
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !hasCount}>{busy ? "Saving…" : "Save end-of-day count"}</Button>
    </form>
  );
}

function DayResult({ shift, onDone }: { shift: DrawerShift; onDone: () => void }) {
  const diff = shift.variance ?? drawerDifference(shift.expectedCash, shift.closingCash ?? 0);
  return (
    <div className="space-y-4">
      <p className={cn("rounded-xl px-4 py-4 text-center text-xl font-semibold", diff === 0 ? "bg-success/10 text-success" : diff < 0 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
        {describeDrawerDifference(diff, formatNPR)}
      </p>
      <dl className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Should be in the drawer</dt><dd className="tabular">{formatNPR(shift.expectedCash)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">You counted</dt><dd className="tabular">{formatNPR(shift.closingCash ?? 0)}</dd></div>
        <div className="flex justify-between border-t border-border pt-2"><dt className="text-muted-foreground">Sales today</dt><dd className="tabular">{formatNPR(shift.totals.sales)} · {shift.totals.orders} bills</dd></div>
        {Object.entries(shift.totals.byMethod).map(([m, amt]) => (
          <div key={m} className="flex justify-between"><dt className="text-muted-foreground">{paymentTitle(m)}</dt><dd className="tabular">{formatNPR(amt)}</dd></div>
        ))}
      </dl>
      <Button variant="brand" size="lg" className="w-full" onClick={onDone}>Done</Button>
    </div>
  );
}
