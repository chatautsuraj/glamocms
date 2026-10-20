"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Ban, FileText, Printer, Undo2 } from "lucide-react";
import { ChannelBadge } from "@/components/channel-badge";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { ShipmentPanel } from "@/components/shipment-panel";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deliveryApi } from "@/lib/api/delivery";
import { ordersApi } from "@/lib/api/orders";
import type { NcmBranch, OrderStatus, PaymentMethod, PosOrder } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDateTime, formatNPR } from "@/lib/format";
import { NEXT_STATUSES, STATUS_LABEL, paymentLabel } from "@/lib/labels";
import { METHOD_SETTING } from "@/lib/pos/payments";
import { toastError } from "@/lib/notify";
import { billForOrder } from "@/lib/pos/order-bill";
import { useEnabledMethods, usePosConfig } from "@/lib/pos/config-store";
import { printBill, printDeliveryNotesFor } from "@/lib/print/print-sale";
import { useApi } from "@/lib/use-api";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useAuthStore((s) => s.permissions);
  const store = useAuthStore((s) => s.store);
  const config = usePosConfig((s) => s.config);
  const canWrite = can.includes("orders.write");
  const canDelivery = can.includes("delivery.manage");
  const { data: order, error, loading, reload, setData } = useApi(() => ordersApi.get(id), [id]);
  const [branches, setBranches] = useState<NcmBranch[] | undefined>();
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    if (canDelivery) deliveryApi.branches().then(setBranches).catch(() => setBranches([]));
  }, [canDelivery]);

  if (error) return <ErrorPanel error={error} onRetry={reload} />;
  if (loading || !order) return <LoadingRows rows={8} />;

  const isDelivery = !order.shippingAddress?.pickup && order.channel !== "POS_COUNTER";
  const allowed = NEXT_STATUSES[order.status] ?? [];
  const terminal = order.status === "CANCELLED" || order.status === "RETURNED" || order.paymentStatus === "REFUNDED";

  const applyStatus = async () => {
    if (!nextStatus) return;
    setBusy(true);
    try {
      setData(await ordersApi.setStatus(order.id, nextStatus, note));
      toast.success(`Order marked ${STATUS_LABEL[nextStatus]}${nextStatus === "PACKED" && isDelivery ? ". Booking Nepal Can Move…" : ""}`);
      setNextStatus("");
      setNote("");
      if (nextStatus === "PACKED") setTimeout(() => void reload(), 1500);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Orders</Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold">{order.printableRef || order.orderNumber}</h1>
            <ChannelBadge channel={order.channel} />
          </div>
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5"><dt className="text-muted-foreground">Order</dt><dd><StatusBadge status={order.status} /></dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-muted-foreground">Payment</dt><dd><StatusBadge status={order.paymentStatus} /></dd></div>
            <div className="text-muted-foreground"><dt className="sr-only">Placed</dt><dd>{order.createdAt && formatDateTime(order.createdAt)}{order.cashier && ` · ${order.cashier.name}`}</dd></div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          {store && <Button variant="outline" onClick={() => void printBill(billForOrder(order, store, config))}><Printer className="h-4 w-4" aria-hidden /> Print bill</Button>}
          {store && isDelivery && <Button variant="outline" onClick={() => void printDeliveryNotesFor([order], store)}><FileText className="h-4 w-4" aria-hidden /> Delivery note</Button>}
          {canWrite && !terminal && <Button variant="outline" onClick={() => setRefundOpen(true)} disabled={order.paymentStatus !== "PAID"} title={order.paymentStatus !== "PAID" ? "Only paid orders can be refunded" : undefined}><Undo2 className="h-4 w-4" aria-hidden /> Refund</Button>}
          {canWrite && !terminal && <Button variant="outline" className="text-danger hover:bg-danger/10" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4" aria-hidden /> Cancel order</Button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr className="border-b border-border"><th scope="col" className="py-2">Item</th><th scope="col" className="py-2 text-right">Qty</th><th scope="col" className="py-2 text-right">Price</th><th scope="col" className="py-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id} className="border-b border-border/60">
                      <td className="py-2">{i.name}{i.variantName && <span className="text-muted-foreground"> — {i.variantName}</span>}<span className="block text-xs text-muted-foreground">{i.sku}</span></td>
                      <td className="tabular py-2 text-right">{i.quantity}</td>
                      <td className="tabular whitespace-nowrap py-2 pl-3 text-right">{formatNPR(i.unitPrice)}</td>
                      <td className="tabular whitespace-nowrap py-2 pl-3 text-right">{formatNPR(i.lineTotal)}{i.lineDiscount > 0 && <span className="block text-xs text-muted-foreground">−{formatNPR(i.lineDiscount)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="tabular ml-auto mt-3 max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatNPR(order.subtotal)}</dd></div>
                {order.discountAmount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>−{formatNPR(order.discountAmount)}</dd></div>}
                {order.shippingCharge > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{formatNPR(order.shippingCharge)}</dd></div>}
                {order.vatAmount > 0 && <div className="flex justify-between text-xs"><dt className="text-muted-foreground">Includes VAT</dt><dd>{formatNPR(order.vatAmount)}</dd></div>}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatNPR(order.totalAmount)}</dd></div>
                {order.refundedAmount > 0 && <div className="flex justify-between text-danger"><dt>Refunded</dt><dd>{formatNPR(order.refundedAmount)}</dd></div>}
              </dl>
            </CardContent>
          </Card>

          {isDelivery && (
            <Card>
              <CardHeader><CardTitle className="text-base">Delivery · Nepal Can Move</CardTitle></CardHeader>
              <CardContent>
                {canDelivery ? (
                  <ShipmentPanel order={order} branches={branches} onChange={(shipment) => setData({ ...order, shipment })} />
                ) : order.shipment ? (
                  <p className="text-sm">Tracking <span className="font-mono">{order.shipment.trackingCode}</span> · <StatusBadge status={order.shipment.status} /></p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not shipped yet.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
            <CardContent>
              {order.timeline.length ? (
                <ol className="space-y-2 border-l-2 border-border pl-4 text-sm">
                  {order.timeline.map((t, i) => (
                    <li key={`${t.at}-${i}`}>
                      <StatusBadge status={t.status} /> <span className="text-xs text-muted-foreground">{t.at && formatDateTime(t.at)}</span>
                      {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-muted-foreground">No history yet.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {canWrite && allowed.length > 0 && !terminal && (
            <Card>
              <CardHeader><CardTitle className="text-base">Update status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field label="New status" hint={isDelivery ? "Marking it Packed books the Nepal Can Move pickup and messages the customer on WhatsApp." : undefined}>
                  <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrderStatus)}>
                    <option value="">Choose…</option>
                    {allowed.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Select>
                </Field>
                <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <Button className="w-full" onClick={applyStatus} disabled={!nextStatus || busy}>{busy ? "Saving…" : "Update status"}</Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{order.customer.walkIn ? order.customer.name : <Link className="text-primary hover:underline" href={`/customers/${encodeURIComponent(order.customer.id)}`}>{order.customer.name}</Link>}</p>
              {order.customer.phone && <p>{order.customer.phone}</p>}
              {order.customer.email && <p className="text-muted-foreground">{order.customer.email}</p>}
              {isDelivery && <p className="text-muted-foreground">{[order.shippingAddress?.address1, order.shippingAddress?.city].filter(Boolean).join(", ")}</p>}
              {order.notes && <p className="rounded-lg bg-muted p-2 text-xs">{order.notes}</p>}
              {order.cancelReason && <p className="text-xs text-danger">Cancelled: {order.cancelReason}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
            <CardContent>
              {order.payments.length ? (
                <ul className="space-y-1 text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>{p.kind === "REFUND" ? "Refund · " : ""}{paymentLabel(p.method)}{p.reference && <span className="text-xs text-muted-foreground"> · {p.reference}</span>}</span>
                      <span className={p.kind === "REFUND" ? "text-danger" : ""}>{p.kind === "REFUND" ? "−" : ""}{formatNPR(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">{order.paymentMethod ? paymentLabel(order.paymentMethod) : "No payments recorded"}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <CancelDialog order={order} open={cancelOpen} onOpenChange={setCancelOpen} onDone={setData} />
      <RefundDialog order={order} open={refundOpen} onOpenChange={setRefundOpen} onDone={setData} />
    </div>
  );
}

function CancelDialog({ order, open, onOpenChange, onDone }: { order: PosOrder; open: boolean; onOpenChange: (o: boolean) => void; onDone: (o: PosOrder) => void }) {
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      onDone(await ordersApi.cancel(order.id, reason.trim(), restock));
      toast.success(restock ? "Order cancelled and items restocked" : "Order cancelled");
      onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Cancel order">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Cancel {order.printableRef || order.orderNumber}</DialogTitle>
          <DialogDescription>{order.channel === "WEBSITE" ? "Website orders always restock and can't be cancelled once shipped." : "Paid tenders are reversed as refunds."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Reason (required)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required minLength={3} /></Field>
          <CheckField label="Return items to stock" checked={restock || order.channel === "WEBSITE"} onChange={setRestock} disabled={order.channel === "WEBSITE"} />
          <Button type="submit" variant="destructive" className="w-full" disabled={busy || reason.trim().length < 3}>{busy ? "Cancelling…" : "Cancel order"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ order, open, onOpenChange, onDone }: { order: PosOrder; open: boolean; onOpenChange: (o: boolean) => void; onDone: (o: PosOrder) => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const suggested = useMemo(
    () => order.items.reduce((s, i) => s + Math.round((i.lineTotal / Math.max(1, i.quantity)) * (qty[i.id] ?? 0)), 0),
    [order.items, qty],
  );
  useEffect(() => {
    if (open) {
      setQty({});
      setAmount("");
      setReason("");
      setReference("");
      setMethod((order.payments.find((p) => p.kind === "PAYMENT")?.method as PaymentMethod) ?? "CASH");
    }
  }, [open, order.payments]);
  const maxRefund = order.totalAmount - order.refundedAmount;
  const enabled = useEnabledMethods();
  // Refund to the methods the shop takes, plus whatever the customer originally paid with.
  const paidWith = order.payments.filter((p) => p.kind === "PAYMENT").map((p) => p.method as PaymentMethod);
  const refundMethods = [...new Set([...enabled, ...paidWith.filter((m) => m in METHOD_SETTING)])];
  const value = amount ? Number(amount) : suggested;
  const submit = async () => {
    setBusy(true);
    try {
      const items = Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
      onDone(await ordersApi.refund(order.id, { items: items.length ? items : undefined, amount: value, method, reason: reason.trim(), restock, reference: reference || undefined }));
      toast.success(`Refunded ${formatNPR(value)}`);
      onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Refund" className="max-w-xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Refund / return</DialogTitle>
          <DialogDescription>Up to {formatNPR(maxRefund)} can still be refunded. Cash refunds are taken from your cash drawer count.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Returned items</legend>
            {order.items.map((i) => (
              <label key={i.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{i.name}{i.variantName ? ` — ${i.variantName}` : ""} <span className="text-muted-foreground">(sold {i.quantity})</span></span>
                <Input inputMode="numeric" className="h-10 w-20" aria-label={`Return quantity for ${i.name}`} value={qty[i.id] ?? ""} placeholder="0"
                  onChange={(e) => setQty({ ...qty, [i.id]: Math.min(i.quantity, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Refund amount (Rs)" hint={suggested ? `Items value ${formatNPR(suggested)}` : undefined}>
              <Input inputMode="numeric" value={amount} placeholder={String(suggested || "")} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Refund method">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {refundMethods.map((m) => <option key={m} value={m}>{paymentLabel(m)}</option>)}
              </Select>
            </Field>
          </div>
          {method !== "CASH" && <Field label="Reference (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
          <Field label="Reason (required)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <CheckField label="Return items to stock" checked={restock} onChange={setRestock} />
          <Button type="submit" className="w-full" disabled={busy || value <= 0 || value > maxRefund || reason.trim().length < 3}>{busy ? "Refunding…" : `Refund ${formatNPR(value)}`}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
