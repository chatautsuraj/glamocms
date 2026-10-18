"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tillApi } from "@/lib/api/till";
import type { TillShift } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import { paymentLabel } from "@/lib/labels";
import { toastError } from "@/lib/notify";
import { tillVariance } from "@/lib/pos/math";
import { cn } from "@/lib/utils";

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
const digits = (v: string) => Number(v.replace(/\D/g, "")) || 0;

export function OpenTillDialog({ open, onOpenChange, onOpened }: { open: boolean; onOpenChange: (o: boolean) => void; onOpened: (s: TillShift) => void }) {
  const [float, setFloat] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setFloat(""); }, [open]);
  const submit = async () => {
    setBusy(true);
    try {
      onOpened(await tillApi.open(digits(float)));
      onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Open till" className="max-w-sm">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Open till</DialogTitle>
          <DialogDescription>Count the opening float in the drawer.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Opening float (Rs)">
            <Input inputMode="numeric" value={float} onChange={(e) => setFloat(e.target.value)} placeholder="0" className="h-12 text-lg" autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Opening…" : "Open till"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CloseTillDialog({ open, onOpenChange, shift, onClosed }: { open: boolean; onOpenChange: (o: boolean) => void; shift: TillShift | null; onClosed: (s: TillShift) => void }) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [manual, setManual] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<TillShift | null>(shift);
  const [result, setResult] = useState<TillShift | null>(null);

  useEffect(() => {
    if (!open) return;
    setCounts({});
    setManual("");
    setNotes("");
    setResult(null);
    setLive(shift);
    tillApi.current().then((s) => s && setLive(s)).catch(() => undefined);
  }, [open, shift]);

  const denomTotal = useMemo(() => DENOMINATIONS.reduce((s, d) => s + d * digits(counts[d] ?? ""), 0), [counts]);
  const counted = manual.trim() ? digits(manual) : denomTotal;
  const expected = live?.expectedCash ?? 0;
  const variance = tillVariance(expected, counted);

  const submit = async () => {
    setBusy(true);
    try {
      const closed = await tillApi.close(counted, notes);
      setResult(closed);
      onClosed(closed);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Close till" className="max-w-2xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{result ? "Till closed" : "Close till & count cash"}</DialogTitle>
          {live && <DialogDescription>Opened {live.openedAt ? new Date(live.openedAt).toLocaleString("en-NP") : ""} by {live.cashierName}</DialogDescription>}
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            <ShiftSummary shift={result} />
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            {live && <ShiftSummary shift={live} />}
            <fieldset className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <legend className="mb-2 text-sm font-medium">Count notes & coins</legend>
              {DENOMINATIONS.map((d) => (
                <label key={d} className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Rs {d} ×</span>
                  <Input inputMode="numeric" value={counts[d] ?? ""} onChange={(e) => setCounts({ ...counts, [d]: e.target.value })} className="h-10" aria-label={`Number of Rs ${d}`} />
                </label>
              ))}
            </fieldset>
            <Field label="…or enter counted cash (Rs)" hint={`Denominations add up to ${formatNPR(denomTotal)}`}>
              <Input inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={String(denomTotal)} />
            </Field>
            <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center text-sm">
              <div><dt className="text-xs text-muted-foreground">Expected</dt><dd className="font-semibold">{formatNPR(expected)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Counted</dt><dd className="font-semibold">{formatNPR(counted)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Variance</dt><dd className={cn("font-semibold", variance < 0 ? "text-danger" : variance > 0 ? "text-warning" : "text-success")} aria-live="polite">{variance > 0 ? "+" : ""}{formatNPR(variance)}</dd></div>
            </dl>
            <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
            <Button type="submit" size="lg" className="w-full" variant="destructive" disabled={busy}>{busy ? "Closing…" : "Close till"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShiftSummary({ shift }: { shift: TillShift }) {
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <dl className="space-y-1 rounded-xl border border-border p-3">
        <div className="flex justify-between"><dt className="text-muted-foreground">Opening float</dt><dd>{formatNPR(shift.openingFloat)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Cash sales</dt><dd>{formatNPR(shift.cashSales)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Expected cash</dt><dd className="font-semibold">{formatNPR(shift.expectedCash)}</dd></div>
        {shift.closingCash !== null && <div className="flex justify-between"><dt className="text-muted-foreground">Counted</dt><dd>{formatNPR(shift.closingCash)}</dd></div>}
        {shift.variance !== null && <div className="flex justify-between"><dt className="text-muted-foreground">Variance</dt><dd className={shift.variance < 0 ? "text-danger" : "text-success"}>{formatNPR(shift.variance)}</dd></div>}
      </dl>
      <dl className="space-y-1 rounded-xl border border-border p-3">
        <div className="flex justify-between"><dt className="text-muted-foreground">Sales</dt><dd>{formatNPR(shift.totals.sales)} · {shift.totals.orders} bills</dd></div>
        {shift.totals.refunds > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Refunds</dt><dd>{formatNPR(shift.totals.refunds)}</dd></div>}
        {Object.entries(shift.totals.byMethod).map(([m, amt]) => (
          <div key={m} className="flex justify-between"><dt className="text-muted-foreground">{paymentLabel(m)}</dt><dd>{formatNPR(amt)}</dd></div>
        ))}
      </dl>
    </div>
  );
}
