"use client";

import Link from "next/link";
import { AlertTriangle, Banknote, Receipt, ScanLine, ShoppingBag, TrendingUp } from "lucide-react";
import { ChannelBadge } from "@/components/channel-badge";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { OrdersTable } from "@/components/orders-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsApi } from "@/lib/api/analytics";
import { catalogApi } from "@/lib/api/catalog";
import { ordersApi } from "@/lib/api/orders";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatNPR, formatNumber } from "@/lib/format";
import { kathmanduDay } from "@/lib/pos/math";
import { useTillShift } from "@/lib/pos/use-till";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const perms = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const canAnalytics = perms.includes("analytics.read");
  const canStock = perms.includes("catalog.write");
  const today = kathmanduDay();
  const { shift } = useTillShift();
  const summary = useApi(() => analyticsApi.summary({ from: today, to: today }), [today], { enabled: canAnalytics });
  const lowStock = useApi(() => catalogApi.list({ lowStock: "true", limit: 8 }), [], { enabled: canStock });
  const recent = useApi(() => ordersApi.list({ limit: 8, ...(perms.includes("orders.read.all") ? { from: today, to: today } : {}) }), [today]);
  const t = summary.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Namaste, ${user?.name?.split(" ")[0] ?? ""}`}
        description={`Today · ${today}`}
        actions={<Link href="/till" className={buttonVariants({ size: "lg" })}><ScanLine className="h-4 w-4" /> Open till</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canAnalytics ? (
          <>
            <StatCard title="Revenue today" value={t ? formatNPR(t.revenue) : "…"} icon={TrendingUp} />
            <StatCard title="Orders today" value={t ? formatNumber(t.orders) : "…"} icon={Receipt} />
            <StatCard title="Average order" value={t ? formatNPR(t.aov) : "…"} icon={ShoppingBag} />
          </>
        ) : (
          <>
            <StatCard title="My sales this shift" value={shift ? formatNPR(shift.totals.sales) : "—"} icon={TrendingUp} />
            <StatCard title="Bills this shift" value={shift ? formatNumber(shift.totals.orders) : "—"} icon={Receipt} />
          </>
        )}
        <StatCard title="Till" value={shift ? "Open" : "Closed"} icon={Banknote} subtitle={shift ? `Expected cash ${formatNPR(shift.expectedCash)}` : "Open it from the Till page"} />
      </div>
      {canAnalytics && summary.data && summary.data.byChannel.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Today by channel</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {summary.data.byChannel.map((c) => (
              <div key={c.channel} className="min-w-[140px] rounded-xl border border-border p-3">
                <ChannelBadge channel={c.channel} />
                <p className="mt-2 text-lg font-semibold">{formatNPR(c.revenue)}</p>
                <p className="text-xs text-muted-foreground">{c.orders} orders</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <Link href="/orders" className="text-sm text-primary hover:underline">All orders</Link>
          </CardHeader>
          <CardContent>{recent.error ? <ErrorPanel error={recent.error} onRetry={recent.reload} /> : recent.loading && !recent.data ? <LoadingRows /> : <OrdersTable orders={recent.data?.items ?? []} showShipment={false} />}</CardContent>
        </Card>
        {canStock && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Low stock</CardTitle>
              <Link href="/inventory" className="text-sm text-primary hover:underline">Inventory</Link>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {(lowStock.data?.items ?? []).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2"><span className="truncate">{p.name}</span><span className={p.stock <= 0 ? "text-danger" : "text-warning"}>{p.stock} left</span></li>
                ))}
                {lowStock.data && !lowStock.data.items.length && <li className="py-4 text-center text-muted-foreground">All stocked up.</li>}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
