"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { commerceClient, type ApiOrder } from "@/lib/commerce-client";
import {
  datePresetLabel,
  filterByCreatedAt,
  resolveDateRange,
  type DatePreset,
} from "@/lib/date-range";
import { printDeliveryNote, printDeliveryNotes } from "@/lib/print-delivery";
import { useApiProducts } from "@/lib/use-api-products";
import { formatNPR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CHANNELS = ["all", "store", "phone", "website", "whatsapp"] as const;

export default function SalesByChannelPage() {
  const { products } = useApiProducts();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logChannel, setLogChannel] = useState<"website" | "whatsapp">("website");
  const [logName, setLogName] = useState("");
  const [logPhone, setLogPhone] = useState("");
  const [logProductId, setLogProductId] = useState("");
  const [logQty, setLogQty] = useState("1");
  const [logBusy, setLogBusy] = useState(false);

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

  useEffect(() => {
    if (!logProductId && products[0]) setLogProductId(products[0].id);
  }, [products, logProductId]);

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const filteredOrders = useMemo(
    () => filterByCreatedAt(orders, dateRange),
    [orders, dateRange],
  );

  const rangeLabel = datePresetLabel(datePreset, customFrom, customTo);

  const totalsByChannel = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const o of filteredOrders) {
      const c = o.channel || "store";
      if (!map[c]) map[c] = { count: 0, amount: 0 };
      map[c].count += 1;
      map[c].amount += Number(o.amount) || 0;
    }
    return map;
  }, [filteredOrders]);

  const grandTotal = filteredOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);

  const printFilteredDelivery = async () => {
    if (!filteredOrders.length) {
      toast.error("No sales in this date range");
      return;
    }
    setPrinting(true);
    try {
      const enriched = await Promise.all(
        filteredOrders.map(async (o) => {
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not print note");
    }
  };

  const submitOnlineSale = async () => {
    const product = products.find((p) => p.id === logProductId);
    if (!product) {
      toast.error("Pick a product");
      return;
    }
    const qty = Math.max(1, Math.floor(Number(logQty) || 1));
    if (!logName.trim()) {
      toast.error("Customer name required");
      return;
    }
    setLogBusy(true);
    try {
      await commerceClient.createOrder({
        channel: logChannel,
        paymentStatus: "paid",
        fulfillmentStatus: "confirmed",
        customer: {
          name: logName.trim(),
          ...(logPhone.trim() ? { phone: logPhone.trim() } : {}),
        },
        amount: product.tradePrice * qty,
        items: [
          {
            productId: product.id,
            qty,
            unitPrice: product.tradePrice,
            name: product.name,
            currentStock: product.stock,
          },
        ],
      });
      toast.success(`${logChannel} sale recorded`);
      setLogOpen(false);
      setLogName("");
      setLogPhone("");
      setLogQty("1");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record sale");
    } finally {
      setLogBusy(false);
    }
  };

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
      cell: (r) => <span className="font-mono text-xs">{r.id}</span>,
    },
    {
      key: "channel",
      header: "Source",
      cell: (r) => (
        <Badge
          variant={
            r.channel === "phone"
              ? "success"
              : r.channel === "store"
                ? "muted"
                : "warning"
          }
        >
          {r.channel === "store" ? "POS" : r.channel}
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
    {
      key: "actions",
      header: "",
      cell: (r) => (
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
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="All sales"
        description="Every sale from POS, phone, website, and WhatsApp — filter by source and date"
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
              {printing ? "Preparing…" : `Print notes (${filteredOrders.length})`}
            </Button>
            <Button variant="outline" onClick={() => setLogOpen(true)}>
              Log website / WhatsApp
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
            {c === "all" ? "All sources" : c === "store" ? "POS" : c}
          </Button>
        ))}
      </div>

      <DateRangeFilter
        preset={datePreset}
        onPresetChange={setDatePreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {channel === "all" ? "All sales" : `${channel === "store" ? "POS" : channel} sales`}
              <span className="ml-1 font-normal">· {rangeLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">{formatNPR(grandTotal)}</p>
            <p className="text-xs text-muted-foreground">{filteredOrders.length} order(s)</p>
          </CardContent>
        </Card>
        {Object.entries(totalsByChannel).map(([c, v]) => (
          <Card key={c}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize text-muted-foreground">
                {c === "store" ? "POS" : c}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{formatNPR(v.amount)}</p>
              <p className="text-xs text-muted-foreground">{v.count} sale(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        data={filteredOrders}
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

      <Dialog open={logOpen} onOpenChange={setLogOpen} className="max-w-md">
        <DialogContent onClose={() => setLogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Log website / WhatsApp sale</DialogTitle>
            <DialogDescription>
              Record an online order so it appears in All sales with the right source
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Source</Label>
              <Select
                value={logChannel}
                onChange={(e) => setLogChannel(e.target.value as "website" | "whatsapp")}
              >
                <option value="website">Website</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Customer name</Label>
              <Input value={logName} onChange={(e) => setLogName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Phone (optional)</Label>
              <Input value={logPhone} onChange={(e) => setLogPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Product</Label>
              <Select value={logProductId} onChange={(e) => setLogProductId(e.target.value)}>
                {products.slice(0, 200).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatNPR(p.tradePrice)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input
                type="number"
                min={1}
                value={logQty}
                onChange={(e) => setLogQty(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={logBusy} onClick={() => void submitOnlineSale()}>
                {logBusy ? "Saving…" : "Record sale"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
