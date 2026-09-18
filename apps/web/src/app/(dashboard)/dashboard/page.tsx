"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Package,
  ShoppingCart,
  Truck,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNPR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { commerceClient, type AnalyticsSummary } from "@/lib/commerce-client";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { analytics: a } = await commerceClient.analytics();
      setAnalytics(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store desk"
        description="Today’s sales, stock alerts, and recent orders"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void reload()}>
              Refresh
            </Button>
            <Link href="/sales/galla">
              <Button>
                <Zap className="h-4 w-4" /> Open POS
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today sales" value={formatNPR(analytics?.todaySales ?? 0)} icon={ShoppingCart} />
        <StatCard title="Week sales" value={formatNPR(analytics?.weekSales ?? 0)} icon={Package} />
        <StatCard title="Orders" value={String(analytics?.orderCount ?? 0)} icon={Boxes} />
        <StatCard
          title="Low stock SKUs"
          value={String(analytics?.lowStockCount ?? 0)}
          icon={AlertTriangle}
          subtitle={`${analytics?.pendingDeliveries ?? 0} pending deliveries`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By fulfillment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(analytics?.byFulfillment ?? {}).map(([k, v]) => (
              <Badge key={k} variant="muted">
                {k}: {v}
              </Badge>
            ))}
            {analytics && Object.keys(analytics.byFulfillment).length === 0 && (
              <p className="text-sm text-muted-foreground">No orders yet</p>
            )}
            {!analytics && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By channel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(analytics?.byChannel ?? {}).map(([k, v]) => (
              <Badge key={k} variant="success">
                {k}: {formatNPR(v)}
              </Badge>
            ))}
            {analytics && Object.keys(analytics.byChannel).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No sales yet —{" "}
                <Link href="/sales/all" className="text-primary underline">
                  view all sales
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent orders</CardTitle>
          <Link href="/sales/all" className="text-sm text-primary inline-flex items-center gap-1">
            All sales <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(analytics?.recentOrders ?? []).map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm",
              )}
            >
              <div>
                <p className="font-medium">{o.customer?.name ?? "Walk-in"}</p>
                <p className="text-xs text-muted-foreground">
                  {o.channel} · {o.fulfillmentStatus} · {new Date(o.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="font-semibold">{formatNPR(Number(o.amount))}</p>
            </motion.div>
          ))}
          {analytics && analytics.recentOrders.length === 0 && (
            <p className="text-sm text-muted-foreground">No orders yet — try Beauty Counter.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/delivery">
          <Button variant="outline">
            <Truck className="h-4 w-4" /> Delivery
          </Button>
        </Link>
        <Link href="/products">
          <Button variant="outline">
            <Package className="h-4 w-4" /> Products
          </Button>
        </Link>
        <Link href="/inventory">
          <Button variant="outline">
            <Boxes className="h-4 w-4" /> Inventory
          </Button>
        </Link>
      </div>
    </div>
  );
}
