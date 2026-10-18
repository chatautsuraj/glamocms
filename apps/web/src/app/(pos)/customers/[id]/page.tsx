"use client";

import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";
import { ChannelBadge } from "@/components/channel-badge";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { customersApi } from "@/lib/api/customers";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDate, formatDateTime, formatNPR } from "@/lib/format";
import { paymentLabel } from "@/lib/labels";
import { toastError } from "@/lib/notify";
import { useApi } from "@/lib/use-api";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canWrite = useAuthStore((s) => s.permissions.includes("customers.write"));
  const detail = useApi(() => customersApi.get(id), [id]);
  const khata = useApi(() => customersApi.khata(id), [id]);
  const [edit, setEdit] = useState(false);
  const [type, setType] = useState<"PAYMENT" | "CHARGE">("PAYMENT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (detail.error) return <ErrorPanel error={detail.error} onRetry={detail.reload} />;
  const c = detail.data;
  if (!c) return <LoadingRows rows={6} />;

  const addEntry = async () => {
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) return;
    setBusy(true);
    try {
      const res = await customersApi.addKhata(c.id, { type, amount: value, method: type === "PAYMENT" ? method : undefined, note: note.trim() || undefined });
      toast.success(`Khata balance now ${formatNPR(res.balance)}`);
      setAmount("");
      setNote("");
      void khata.reload();
      void detail.reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/customers" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Customers</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{c.name}</h1>
        <span className="text-sm text-muted-foreground">{[c.phone, c.email, c.address].filter(Boolean).join(" · ")}</span>
        {canWrite && <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Orders" value={c.stats.orders} />
        <StatCard title="Total spent" value={formatNPR(c.stats.totalSpent)} />
        <StatCard title="Average order" value={formatNPR(c.stats.aov)} />
        <StatCard title="Khata due" value={formatNPR(c.khataBalance)} subtitle={c.stats.lastOrderAt ? `Last order ${formatDate(c.stats.lastOrderAt)}` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent orders</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {c.recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Link href={`/orders/${encodeURIComponent(o.id)}`} className="font-mono text-xs text-primary hover:underline">{o.printableRef || o.orderNumber}</Link>
                  <ChannelBadge channel={o.channel} />
                  <StatusBadge status={o.status} />
                  <span className="ml-auto font-medium">{formatNPR(o.totalAmount)}</span>
                  <span className="w-full text-xs text-muted-foreground">{o.createdAt && formatDateTime(o.createdAt)}</span>
                </li>
              ))}
              {!c.recentOrders.length && <li className="py-6 text-center text-muted-foreground">No orders yet.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Khata (credit ledger) · balance {formatNPR(khata.data?.balance ?? c.khataBalance)}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {canWrite && (
              <form className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void addEntry(); }}>
                <Field label="Entry">
                  <Select value={type} onChange={(e) => setType(e.target.value as "PAYMENT" | "CHARGE")}>
                    <option value="PAYMENT">Payment received</option>
                    <option value="CHARGE">Charge (add to due)</option>
                  </Select>
                </Field>
                <Field label="Amount (Rs)"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /></Field>
                {type === "PAYMENT" && (
                  <Field label="Method">
                    <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                      {PAYMENT_METHODS.filter((m) => m !== "CREDIT").map((m) => <option key={m} value={m}>{paymentLabel(m)}</option>)}
                    </Select>
                  </Field>
                )}
                <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <Button type="submit" className="sm:col-span-2" disabled={busy || !Number(amount)}>{busy ? "Saving…" : "Add entry"}</Button>
              </form>
            )}
            {khata.error ? <ErrorPanel error={khata.error} onRetry={khata.reload} /> : (
              <ul className="divide-y divide-border text-sm">
                {(khata.data?.entries ?? []).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className={e.type === "CHARGE" ? "font-medium text-warning" : "font-medium text-success"}>{e.type === "CHARGE" ? "+" : "−"}{formatNPR(e.amount)}</span>
                    <span>{e.type === "CHARGE" ? "Charge" : `Payment${e.method ? ` · ${paymentLabel(e.method)}` : ""}`}</span>
                    {e.orderRef && <span className="font-mono text-xs">{e.orderRef}</span>}
                    {e.note && <span className="text-xs text-muted-foreground">{e.note}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{e.createdAt && formatDateTime(e.createdAt)}</span>
                  </li>
                ))}
                {!khata.data?.entries.length && <li className="py-6 text-center text-muted-foreground">No khata entries.</li>}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <CustomerFormDialog open={edit} onOpenChange={setEdit} customer={c} onSaved={() => void detail.reload()} />
    </div>
  );
}
