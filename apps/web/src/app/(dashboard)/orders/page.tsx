"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { commerceClient, type ApiOrder } from "@/lib/commerce-client";
import {
  datePresetLabel,
  filterByCreatedAt,
  resolveDateRange,
  type DatePreset,
} from "@/lib/date-range";
import { formatNPR } from "@/lib/format";
import { printDeliveryNote, printDeliveryNotes } from "@/lib/print-delivery";
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
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const filteredOrders = useMemo(
    () => filterByCreatedAt(orders, dateRange),
    [orders, dateRange],
  );

  const rangeLabel = datePresetLabel(datePreset, customFrom, customTo);

  const printFilteredDelivery = async () => {
    const printable = filteredOrders.filter((o) => o.fulfillmentStatus !== "cancelled");
    if (!printable.length) {
      toast.error("No orders in this date range");
      return;
    }
    setPrinting(true);
    try {
      const enriched = await Promise.all(
        printable.map(async (o) => {
          if (o.items?.length) return o;
          try {
            const { order } = await commerceClient.getOrder(o.id);
            return order;
          } catch {
            return o;
          }
        }),
      );
      const ok = printDeliveryNotes({ orders: enriched, rangeLabel });
      if (!ok) toast.error("Allow pop-ups to print delivery notes");
      else toast.success(`Printing ${enriched.length} delivery note(s)`);
    } finally {
      setPrinting(false);
    }
  };

  const printOneNote = async (row: ApiOrder) => {
    try {
      let order = row;
      if (!row.items?.length) {
        const res = await commerceClient.getOrder(row.id);
        order = res.order;
      }
      const ok = printDeliveryNote(order);
      if (!ok) toast.error("Allow pop-ups to print");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not print note");
    }
  };

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
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  void printOneNote(r);
                }}
              >
                Note
              </Button>
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
            </div>
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
        description="All channels — store / website / WhatsApp — filter by date, print delivery run"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
            <Button
              variant="outline"
              disabled={printing || !filteredOrders.length}
              onClick={() => void printFilteredDelivery()}
            >
              {printing ? "Preparing…" : `Print notes (${filteredOrders.filter((o) => o.fulfillmentStatus !== "cancelled").length})`}
            </Button>
          </div>
        }
      />
      <DateRangeFilter
        preset={datePreset}
        onPresetChange={setDatePreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <DataTable
        data={filteredOrders}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.id, (r) => r.customer?.name ?? "", (r) => r.channel]}
        exportFilename="glamo-orders"
      />
    </div>
  );
}
