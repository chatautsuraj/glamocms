"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { commerceClient, type ApiOrder } from "@/lib/commerce-client";
import { formatNPR } from "@/lib/format";
import { toast } from "sonner";

const FULFILLMENT = [
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export default function OrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { orders: list } = await commerceClient.listOrders();
      setOrders(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const columns: Column<ApiOrder>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Order",
        cell: (r) => <span className="font-mono text-xs">{r.id.slice(0, 10)}…</span>,
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
        key: "channel",
        header: "Channel",
        cell: (r) => (
          <Badge variant={r.channel === "phone" ? "success" : "muted"}>{r.channel}</Badge>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        cell: (r) => formatNPR(Number(r.amount)),
        className: "text-right",
        sortValue: (r) => Number(r.amount),
      },
      {
        key: "payment",
        header: "Payment",
        cell: (r) => <Badge variant={r.paymentStatus === "paid" ? "success" : "muted"}>{r.paymentStatus}</Badge>,
      },
      {
        key: "fulfillment",
        header: "Fulfillment",
        cell: (r) => (
          <Select
            value={r.fulfillmentStatus}
            disabled={r.fulfillmentStatus === "cancelled"}
            onChange={async (e) => {
              try {
                await commerceClient.updateOrder(r.id, { fulfillmentStatus: e.target.value });
                toast.success("Status updated");
                await reload();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Update failed");
              }
            }}
          >
            {FULFILLMENT.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        ),
      },
      {
        key: "created",
        header: "Created",
        cell: (r) => new Date(r.createdAt).toLocaleString(),
        sortValue: (r) => r.createdAt,
      },
      {
        key: "actions",
        header: "",
        cell: (r) =>
          r.fulfillmentStatus === "cancelled" ? null : (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm("Cancel order and restock items?")) return;
                try {
                  await commerceClient.cancelOrder(r.id);
                  toast.success("Order cancelled — stock restored");
                  await reload();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Cancel failed");
                }
              }}
            >
              Cancel
            </Button>
          ),
        className: "text-right",
      },
    ],
    [reload],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="All channels — store / website / WhatsApp — from the shared database"
        actions={
          <Button variant="outline" onClick={() => void reload()} disabled={loading}>
            Refresh
          </Button>
        }
      />
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <DataTable
        data={orders}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.id, (r) => r.customer?.name ?? "", (r) => r.channel]}
        exportFilename="glamo-orders"
      />
    </div>
  );
}
