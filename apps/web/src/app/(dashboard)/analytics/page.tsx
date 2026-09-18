"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNPR } from "@/lib/format";
import { commerceClient, type AnalyticsSummary } from "@/lib/commerce-client";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { analytics: a } = await commerceClient.analytics();
      setAnalytics(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Real totals from Nest / Postgres (SQLite locally)"
        actions={
          <Button variant="outline" onClick={() => void reload()}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Today: <strong>{formatNPR(analytics?.todaySales ?? 0)}</strong></p>
            <p>Last 7 days: <strong>{formatNPR(analytics?.weekSales ?? 0)}</strong></p>
            <p>Paid orders: <strong>{analytics?.paidOrderCount ?? 0}</strong></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total orders: <strong>{analytics?.orderCount ?? 0}</strong></p>
            <p>Pending deliveries: <strong>{analytics?.pendingDeliveries ?? 0}</strong></p>
            <p>Low stock SKUs: <strong>{analytics?.lowStockCount ?? 0}</strong></p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fulfillment mix</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(analytics?.byFulfillment ?? {}).map(([k, v]) => (
            <Badge key={k} variant="muted">{k}: {v}</Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
