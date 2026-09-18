"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { commerceClient, type ApiOrder } from "@/lib/commerce-client";
import { formatNPR } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHANNELS = ["all", "store", "phone", "website", "whatsapp"] as const;

export default function SalesByChannelPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { orders: list } = await commerceClient.listOrders(
        channel === "all" ? undefined : { channel },
      );
      setOrders(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalsByChannel = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const o of orders) {
      const c = o.channel || "store";
      if (!map[c]) map[c] = { count: 0, amount: 0 };
      map[c].count += 1;
      map[c].amount += Number(o.amount) || 0;
    }
    return map;
  }, [orders]);

  const grandTotal = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);

  const columns: Column<ApiOrder>[] = [
    {
      key: "when",
      header: "When",
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
      sortValue: (r) => r.createdAt,
    },
    {
      key: "id",
      header: "Sale #",
      cell: (r) => <span className="font-mono text-xs">{r.id.slice(0, 12)}…</span>,
    },
    {
      key: "channel",
      header: "Source",
      cell: (r) => (
        <Badge variant={r.channel === "phone" ? "success" : r.channel === "store" ? "muted" : "warning"}>
          {r.channel}
        </Badge>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.customer?.name ?? "Walk-in"}</p>
          {r.customer?.phone && (
            <p className="text-xs text-muted-foreground">{r.customer.phone}</p>
          )}
        </div>
      ),
      sortValue: (r) => r.customer?.name ?? "",
    },
    {
      key: "pay",
      header: "Payment",
      cell: (r) => <Badge variant="muted">{r.paymentStatus}</Badge>,
    },
    {
      key: "ship",
      header: "Fulfillment",
      cell: (r) => <Badge variant="muted">{r.fulfillmentStatus}</Badge>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => <span className="font-semibold text-primary">{formatNPR(Number(r.amount))}</span>,
      className: "text-right",
      sortValue: (r) => Number(r.amount),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="All sales"
        description="Every sale from counter, phone, website, and WhatsApp — filter by source"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
            <Link href="/sales/galla">
              <Button>Open POS</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={channel === c ? "default" : "outline"}
            onClick={() => setChannel(c)}
            className={cn("capitalize")}
          >
            {c === "all" ? "All sources" : c}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {channel === "all" ? "All sales" : `${channel} sales`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">{formatNPR(grandTotal)}</p>
            <p className="text-xs text-muted-foreground">{orders.length} order(s)</p>
          </CardContent>
        </Card>
        {Object.entries(totalsByChannel).map(([c, v]) => (
          <Card key={c}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize text-muted-foreground">{c}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{formatNPR(v.amount)}</p>
              <p className="text-xs text-muted-foreground">{v.count} sale(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        data={orders}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[
          (r) => r.id,
          (r) => r.channel,
          (r) => r.customer?.name ?? "",
          (r) => r.customer?.phone ?? "",
        ]}
        exportFilename="glamo-sales-by-channel"
      />
    </div>
  );
}
