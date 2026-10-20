"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { ChannelBadge } from "@/components/channel-badge";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customersApi } from "@/lib/api/customers";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDate, formatDateTime, formatNPR, formatNumber } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canWrite = useAuthStore((s) => s.permissions.includes("customers.write"));
  const detail = useApi(() => customersApi.get(id), [id]);
  const [edit, setEdit] = useState(false);

  if (detail.error) return <ErrorPanel error={detail.error} onRetry={detail.reload} />;
  const c = detail.data;
  if (!c) return <LoadingRows rows={6} />;

  return (
    <div className="space-y-4">
      <Link href="/customers" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden /> Customers</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{c.name}</h1>
        <span className="text-sm text-muted-foreground">{[c.phone, c.email, c.address].filter(Boolean).join(" · ")}</span>
        {canWrite && <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Orders" value={formatNumber(c.stats.orders)} />
        <StatCard title="Total spent" value={formatNPR(c.stats.totalSpent)} />
        <StatCard title="Average order" value={formatNPR(c.stats.aov)} />
        <StatCard title="Last order" value={c.stats.lastOrderAt ? formatDate(c.stats.lastOrderAt) : "—"} />
      </div>
      <Card>
        <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {c.recentOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/orders/${encodeURIComponent(o.id)}`} className="font-mono text-xs font-medium text-primary hover:underline">{o.printableRef || o.orderNumber}</Link>
                <ChannelBadge channel={o.channel} />
                <StatusBadge status={o.status} />
                <span className="text-xs text-muted-foreground">{o.createdAt && formatDateTime(o.createdAt)}</span>
                <span className="tabular ml-auto font-semibold">{formatNPR(o.totalAmount)}</span>
              </li>
            ))}
            {!c.recentOrders.length && <li className="py-6 text-center text-muted-foreground">No orders yet.</li>}
          </ul>
        </CardContent>
      </Card>
      <CustomerFormDialog open={edit} onOpenChange={setEdit} customer={c} onSaved={() => void detail.reload()} />
    </div>
  );
}
