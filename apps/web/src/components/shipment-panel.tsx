"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, RefreshCw, Send, Truck } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deliveryApi } from "@/lib/api/delivery";
import type { NcmBranch, PosOrder, Shipment } from "@/lib/api/types";
import { formatDateTime, formatNPR } from "@/lib/format";
import { SHIPMENT_LABEL, SHIPMENT_STAGES } from "@/lib/labels";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** NCM shipment: tracking code, stage timeline, Send to NCM, refresh. */
export function ShipmentPanel({ order, branches, onChange }: { order: PosOrder; branches?: NcmBranch[]; onChange: (s: Shipment) => void }) {
  const s = order.shipment;
  const [busy, setBusy] = useState<"send" | "refresh" | null>(null);
  const [branch, setBranch] = useState(String(order.shippingAddress?.branch ?? ""));
  const [cod, setCod] = useState(String(order.shippingAddress?.codAmount ?? Math.max(0, order.totalAmount - order.payments.filter((p) => p.kind === "PAYMENT").reduce((a, p) => a + p.amount, 0))));
  const [instruction, setInstruction] = useState("");
  const pickup = Boolean(order.shippingAddress?.pickup);

  const send = async () => {
    setBusy("send");
    try {
      const shipment = await deliveryApi.send(order.id, { branch: branch || undefined, codAmount: Number(cod) || 0, instruction: instruction || undefined });
      onChange(shipment);
      toast.success(`Sent to Nepal Can Move${shipment.trackingCode ? `, tracking ${shipment.trackingCode}` : ""}`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  };
  const refresh = async () => {
    setBusy("refresh");
    try {
      onChange(await deliveryApi.refresh(order.id));
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  };

  if (pickup) return <p className="text-sm text-muted-foreground">Picked up at the counter. No delivery needed.</p>;

  if (!s || s.status === "ERROR") {
    return (
      <div className="space-y-3">
        {s?.status === "ERROR" && <p role="alert" className="text-sm text-danger">NCM error: {s.error ?? s.lastStatus ?? "unknown"} — fix and retry.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="NCM destination branch" hint="Leave empty to match the city automatically">
            {branches?.length ? (
              <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Auto (from city)</option>
                {branches.map((b) => <option key={b.code || b.name} value={b.name}>{b.name}{b.district ? `, ${b.district}` : ""}</option>)}
              </Select>
            ) : (
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. POKHARA" />
            )}
          </Field>
          <Field label="COD amount (Rs)"><Input inputMode="numeric" value={cod} onChange={(e) => setCod(e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="Instruction (optional)"><Input value={instruction} onChange={(e) => setInstruction(e.target.value)} /></Field>
        </div>
        <Button onClick={send} disabled={busy !== null}><Send className="h-4 w-4" /> {busy === "send" ? "Sending…" : "Send to NCM"}</Button>
      </div>
    );
  }

  const reached = SHIPMENT_STAGES.indexOf(s.status as (typeof SHIPMENT_STAGES)[number]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Truck className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm">NCM tracking <strong className="font-mono">{s.trackingCode ?? s.externalId ?? "—"}</strong></span>
        <StatusBadge status={s.status} />
        {s.lastStatus && <span className="text-xs text-muted-foreground">“{s.lastStatus}”</span>}
        {s.charge !== null && <span className="text-xs text-muted-foreground">Charge {formatNPR(s.charge)}</span>}
        {s.codAmount !== null && <span className="text-xs text-muted-foreground">COD {formatNPR(s.codAmount)}</span>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={refresh} disabled={busy !== null}>
          <RefreshCw className={cn("h-3.5 w-3.5", busy === "refresh" && "animate-spin")} /> Refresh
        </Button>
      </div>
      {s.status === "RETURNED_TO_SENDER" ? (
        <p className="text-sm text-danger">Returned to sender.</p>
      ) : (
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Delivery stages">
          {SHIPMENT_STAGES.map((stage, i) => {
            const doneStage = reached >= i;
            return (
              <li key={stage} className={cn("rounded-lg border px-2 py-2 text-center text-xs", doneStage ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground")} aria-current={reached === i ? "step" : undefined}>
                {doneStage && <Check className="mx-auto mb-1 h-3.5 w-3.5" aria-hidden />}
                {SHIPMENT_LABEL[stage]}
              </li>
            );
          })}
        </ol>
      )}
      {s.timeline?.length > 0 && (
        <ul className="space-y-1 border-l-2 border-border pl-3 text-xs">
          {[...s.timeline].reverse().map((t, i) => (
            <li key={`${t.at}-${i}`}>
              <span className="font-medium">{SHIPMENT_LABEL[t.internalStatus ?? ""] ?? t.status}</span>
              {t.location && <span className="text-muted-foreground"> · {t.location}</span>}
              <span className="text-muted-foreground"> · {t.at ? formatDateTime(t.at) : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
