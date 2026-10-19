"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, PackageCheck, Printer, RefreshCw, Send } from "lucide-react";
import { ChannelBadge } from "@/components/channel-badge";
import { ChannelSwitcher } from "@/components/channel-switcher";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deliveryApi } from "@/lib/api/delivery";
import { ordersApi } from "@/lib/api/orders";
import type { Channel, NcmBranch, NcmRate, PosOrder } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDateTime, formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { printDeliveryNotesFor } from "@/lib/print/print-sale";
import { useDefaultDeliveryType } from "@/lib/use-delivery-defaults";
import { useApi } from "@/lib/use-api";

const STAGES = [
  { key: "toship", label: "To pack & ship", status: "CONFIRMED,PROCESSING,PACKED" },
  { key: "transit", label: "In transit", status: "SHIPPED,OUT_FOR_DELIVERY" },
  { key: "delivered", label: "Delivered", status: "DELIVERED" },
  { key: "returned", label: "Returned", status: "RETURNED" },
];

export default function DeliveryPage() {
  const store = useAuthStore((s) => s.store);
  const [stage, setStage] = useState("toship");
  const [channel, setChannel] = useState<Channel | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const status = STAGES.find((s) => s.key === stage)!.status;
  const { data, error, loading, reload, setData } = useApi(() => ordersApi.list({ status, channel, page, limit: 25 }), [status, channel, page]);
  const orders = useMemo(() => (data?.items ?? []).filter((o) => !o.shippingAddress?.pickup && o.channel !== "POS_COUNTER"), [data]);

  useEffect(() => setSelected(new Set()), [stage, channel, page]);

  const replace = (o: PosOrder) => data && setData({ ...data, items: data.items.map((x) => (x.id === o.id ? o : x)) });

  const act = async (o: PosOrder, kind: "pack" | "send" | "refresh") => {
    setBusy(`${kind}:${o.id}`);
    try {
      if (kind === "pack") {
        replace(await ordersApi.setStatus(o.id, "PACKED"));
        toast.success(`${o.printableRef || o.orderNumber} packed. Booking Nepal Can Move…`);
        setTimeout(() => void reload(), 1500);
      } else {
        const shipment = kind === "send" ? await deliveryApi.send(o.id) : await deliveryApi.refresh(o.id);
        replace({ ...o, shipment });
        if (kind === "send") toast.success(`Sent to Nepal Can Move${shipment.trackingCode ? `, tracking ${shipment.trackingCode}` : ""}`);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  };

  const printSelected = () => {
    const list = orders.filter((o) => selected.has(o.id));
    if (!store || !list.length) return;
    void printDeliveryNotesFor(list, store, STAGES.find((s) => s.key === stage)?.label);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Delivery" description="Orders to deliver with Nepal Can Move. Mark an order Packed when it is ready; NCM is booked automatically if that is switched on in Settings." />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label="Delivery stage" className="flex flex-wrap gap-2">
                {STAGES.map((s) => <Button key={s.key} size="sm" variant={stage === s.key ? "default" : "outline"} aria-pressed={stage === s.key} onClick={() => { setStage(s.key); setPage(1); }}>{s.label}</Button>)}
              </div>
              <Button variant="outline" size="sm" className="ml-auto" disabled={!selected.size} onClick={printSelected}><Printer className="h-3.5 w-3.5" aria-hidden /> Print delivery notes ({selected.size})</Button>
            </div>
            <ChannelSwitcher value={channel} onChange={(c) => { setChannel(c); setPage(1); }} />
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
              <ul className="divide-y divide-border">
                {orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                    <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--rose-dark)]" aria-label={`Select ${o.printableRef || o.orderNumber}`} checked={selected.has(o.id)}
                      onChange={(e) => { const next = new Set(selected); if (e.target.checked) next.add(o.id); else next.delete(o.id); setSelected(next); }} />
                    <div className="min-w-[200px] flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/orders/${encodeURIComponent(o.id)}`} className="font-mono text-xs font-medium text-primary hover:underline">{o.printableRef || o.orderNumber}</Link>
                        <ChannelBadge channel={o.channel} />
                        <StatusBadge status={o.status} />
                        <StatusBadge status={o.paymentStatus} />
                      </div>
                      <p>{o.shippingAddress?.fullName || o.customer.name} · {o.shippingAddress?.phone || o.customer.phone}</p>
                      <p className="text-xs text-muted-foreground">{[o.shippingAddress?.address1, o.shippingAddress?.city, o.shippingAddress?.branch && `NCM ${o.shippingAddress.branch}`].filter(Boolean).join(", ")} · {formatNPR(o.totalAmount)} · {o.createdAt && formatDateTime(o.createdAt)}</p>
                      {o.shipment && (
                        <p className="flex flex-wrap items-center gap-2 text-xs">
                          NCM <span className="font-mono font-medium">{o.shipment.trackingCode ?? "—"}</span> <StatusBadge status={o.shipment.status} />
                          {o.shipment.status === "ERROR" && <span className="text-danger">{o.shipment.error}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(o.status === "CONFIRMED" || o.status === "PROCESSING") && (
                        <Button size="sm" onClick={() => void act(o, "pack")} disabled={busy !== null}><PackageCheck className="h-3.5 w-3.5" /> Mark packed</Button>
                      )}
                      {(!o.shipment || o.shipment.status === "ERROR") && (
                        <Button size="sm" variant="outline" onClick={() => void act(o, "send")} disabled={busy !== null}><Send className="h-3.5 w-3.5" /> Send to NCM</Button>
                      )}
                      {o.shipment && o.shipment.status !== "ERROR" && (
                        <Button size="sm" variant="ghost" onClick={() => void act(o, "refresh")} disabled={busy !== null} aria-label={`Refresh tracking for ${o.printableRef || o.orderNumber}`}>
                          <RefreshCw className={busy === `refresh:${o.id}` ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
                {!orders.length && <li className="py-10 text-center text-sm text-muted-foreground">No delivery orders here.</li>}
              </ul>
            )}
            {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
          </CardContent>
        </Card>
        <NcmTools />
      </div>
    </div>
  );
}

function NcmTools() {
  const defaultType = useDefaultDeliveryType();
  const [branches, setBranches] = useState<NcmBranch[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [filter, setFilter] = useState("");
  const [destination, setDestination] = useState("");
  const [type, setType] = useState("");
  useEffect(() => {
    if (defaultType) setType((t) => t || defaultType);
  }, [defaultType]);
  const [rate, setRate] = useState<NcmRate | null>(null);
  const load = (refresh = false) => deliveryApi.branches(refresh).then((b) => { setBranches(b); setErr(null); }).catch(setErr);
  useEffect(() => { void load(); }, []);
  const quote = async () => {
    try {
      setRate(await deliveryApi.rate(destination, type || undefined));
    } catch (e) {
      toastError(e);
    }
  };
  const shown = branches.filter((b) => `${b.name} ${b.district}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4" aria-hidden /> NCM rate</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void quote(); }}>
            <Field label="Destination branch">
              <Select value={destination} onChange={(e) => setDestination(e.target.value)} required>
                <option value="">Choose…</option>
                {branches.map((b) => <option key={b.code || b.name} value={b.name}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Delivery type"><Input value={type} onChange={(e) => setType(e.target.value)} /></Field>
            <Button type="submit" className="w-full" disabled={!destination}>Get rate</Button>
            {rate && <p className="text-sm" role="status">{rate.creation} → {rate.destination}: <strong>{formatNPR(rate.charge)}</strong></p>}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">NCM branches</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => void load(true)}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {err ? <ErrorPanel error={err} onRetry={() => void load()} /> : (
            <>
              <Input aria-label="Find a branch" placeholder="Find a branch or district" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <ul className="max-h-80 divide-y divide-border overflow-y-auto text-sm">
                {shown.map((b) => <li key={b.code || b.name} className="py-1.5"><span className="font-medium">{b.name}</span> <span className="text-xs text-muted-foreground">{b.district}{b.phone ? ` · ${b.phone}` : ""}</span></li>)}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
