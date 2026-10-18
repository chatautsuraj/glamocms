"use client";

import Link from "next/link";
import { AlertTriangle, Receipt, ScanLine, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { ChannelBadge } from "@/components/channel-badge";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { OrdersTable } from "@/components/orders-table";
import { PageHeader } from "@/components/page-header";
import { ProductImage } from "@/components/product-image";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsApi } from "@/lib/api/analytics";
import { catalogApi } from "@/lib/api/catalog";
import { ordersApi } from "@/lib/api/orders";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDate, formatNPR, formatNumber } from "@/lib/format";
import { kathmanduDay } from "@/lib/pos/math";
import { useCashDrawer } from "@/lib/pos/use-cash-drawer";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const perms = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const canAnalytics = perms.includes("analytics.read");
  const canStock = perms.includes("catalog.write");
  const canSell = perms.includes("pos.sell");
  const today = kathmanduDay();
  const { drawer } = useCashDrawer();
  const summary = useApi(() => analyticsApi.summary({ from: today, to: today }), [today], { enabled: canAnalytics });
  const lowStock = useApi(() => catalogApi.list({ lowStock: "true", limit: 8 }), [], { enabled: canStock });
  const recent = useApi(() => ordersApi.list({ limit: 8, ...(perms.includes("orders.read.all") ? { from: today, to: today } : {}) }), [today]);
  const t = summary.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Namaste${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={`Today · ${formatDate(new Date())}`}
        actions={canSell && <Link href="/pos" className={buttonVariants({ variant: "brand", size: "lg" })}><ScanLine className="h-5 w-5" aria-hidden /> Start selling</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canAnalytics ? (
          <>
            <StatCard title="Sales today" value={t ? formatNPR(t.revenue) : "…"} icon={TrendingUp} loading={summary.loading && !t} />
            <StatCard title="Bills today" value={t ? formatNumber(t.orders) : "…"} icon={Receipt} loading={summary.loading && !t} />
            <StatCard title="Average bill" value={t ? formatNPR(t.aov) : "…"} icon={ShoppingBag} loading={summary.loading && !t} />
          </>
        ) : (
          <>
            <StatCard title="My sales (cash drawer)" value={drawer ? formatNPR(drawer.totals.sales) : "—"} icon={TrendingUp} subtitle={drawer ? undefined : "Shown after you enter the starting cash"} />
            <StatCard title="My bills (cash drawer)" value={drawer ? formatNumber(drawer.totals.orders) : "—"} icon={Receipt} />
          </>
        )}
        {canSell && (
          <StatCard
            title="Cash drawer"
            value={drawer ? formatNPR(drawer.expectedCash) : "Not started"}
            icon={Wallet}
            subtitle={drawer ? "Cash that should be in the drawer now" : "Optional. Open POS → ⋮ → Cash drawer"}
          />
        )}
      </div>
      {canAnalytics && summary.error ? <ErrorPanel error={summary.error} onRetry={summary.reload} /> : null}
      {canAnalytics && summary.data && summary.data.byChannel.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Today by channel</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {summary.data.byChannel.map((c) => (
              <div key={c.channel} className="min-w-[150px] rounded-xl border border-border p-3">
                <ChannelBadge channel={c.channel} />
                <p className="tabular mt-2 text-lg font-semibold">{formatNPR(c.revenue)}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(c.orders)} {c.orders === 1 ? "bill" : "bills"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Latest sales</CardTitle>
            <Link href="/orders" className="text-sm font-medium text-primary hover:underline">All orders</Link>
          </CardHeader>
          <CardContent>{recent.error ? <ErrorPanel error={recent.error} onRetry={recent.reload} /> : recent.loading && !recent.data ? <LoadingRows /> : <OrdersTable orders={recent.data?.items ?? []} showShipment={false} emptyText="No sales yet today." />}</CardContent>
        </Card>
        {canStock && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Running low</CardTitle>
              <Link href="/inventory" className="text-sm font-medium text-primary hover:underline">Stock</Link>
            </CardHeader>
            <CardContent>
              {lowStock.error ? <ErrorPanel error={lowStock.error} onRetry={lowStock.reload} /> : lowStock.loading && !lowStock.data ? <LoadingRows rows={4} /> : (
                <ul className="divide-y divide-border text-sm">
                  {(lowStock.data?.items ?? []).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <ProductImage src={p.imageUrl} name={p.name} className="h-9 w-9 shrink-0 border border-border" />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className={p.stock <= 0 ? "font-semibold text-danger" : "font-semibold text-warning"}>{p.stock <= 0 ? "Out" : `${p.stock} left`}</span>
                    </li>
                  ))}
                  {lowStock.data && !lowStock.data.items.length && <li className="py-4 text-center text-muted-foreground">Everything is well stocked.</li>}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
