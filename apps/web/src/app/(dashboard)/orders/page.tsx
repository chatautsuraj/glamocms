"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Search, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { commerceClient, type ApiOrder } from "@/lib/commerce-client";
import {
  datePresetLabel,
  filterByCreatedAt,
  resolveDateRange,
  type DatePreset,
} from "@/lib/date-range";
import { formatNPR } from "@/lib/format";
import { downloadStoreBillPdf } from "@/lib/print-bill";
import { printDeliveryNote, printDeliveryNotes } from "@/lib/print-delivery";
import { syncCallerToAppStore } from "@/lib/sync-caller";
import { useApiProducts } from "@/lib/use-api-products";
import { toast } from "sonner";

const FULFILLMENT = [
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

type Line = { productId: string; name: string; price: number; qty: number };

export default function OrdersPage() {
  const { products } = useApiProducts();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [phoneOpen, setPhoneOpen] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const [edit, setEdit] = useState<ApiOrder | null>(null);
  const [assignee, setAssignee] = useState("");
  const [delAddress, setDelAddress] = useState("");
  const [delNotes, setDelNotes] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [status, setStatus] = useState("confirmed");

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("new") === "phone") {
      setPhoneOpen(true);
    }
  }, []);

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const filteredOrders = useMemo(
    () => filterByCreatedAt(orders, dateRange),
    [orders, dateRange],
  );

  const rangeLabel = datePresetLabel(datePreset, customFrom, customTo);

  const matches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, productSearch]);

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const addProduct = (p: (typeof products)[0]) => {
    setCart((prev) => {
      const hit = prev.find((l) => l.productId === p.id);
      if (hit) return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { productId: p.id, name: p.name, price: p.tradePrice, qty: 1 }];
    });
  };

  const placePhoneOrder = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Caller name and phone are required");
      return;
    }
    if (!address.trim()) {
      toast.error("Delivery address is required");
      return;
    }
    if (!cart.length) {
      toast.error("Add at least one product");
      return;
    }
    setSaving(true);
    try {
      const n = name.trim();
      const p = phone.trim();
      const addr = address.trim();
      const { order } = await commerceClient.createOrder({
        channel: "phone",
        paymentStatus: "unpaid",
        fulfillmentStatus: "confirmed",
        customer: { name: n, phone: p },
        deliveryAddress: addr,
        deliveryNotes: notes.trim() || `Phone order · ${p}`,
        items: cart.map((l) => {
          const product = products.find((x) => x.id === l.productId);
          return {
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.price,
            name: l.name,
            currentStock: product?.stock,
          };
        }),
      });
      syncCallerToAppStore({ name: n, phone: p, area: addr || "Phone" });
      downloadStoreBillPdf({
        orderId: order.id,
        customerName: n,
        customerPhone: p,
        method: "PHONE / COD",
        channel: "phone",
        lines: cart.map((l) => ({
          name: l.name,
          qty: l.qty,
          unitPrice: l.price,
          lineTotal: l.price * l.qty,
        })),
        subtotal: total,
        vat: 0,
        total,
        vatEnabled: false,
      });
      toast.success(`Phone order ${order.id}`);
      setCart([]);
      setNotes("");
      setPhoneOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSaving(false);
    }
  };

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

  const openDelivery = (r: ApiOrder) => {
    setEdit(r);
    setAssignee(r.deliveryAssignee ?? "");
    setDelAddress(r.deliveryAddress ?? "");
    setDelNotes(r.deliveryNotes ?? "");
    setScheduled(r.deliveryScheduledAt ? r.deliveryScheduledAt.slice(0, 10) : "");
    setStatus(r.fulfillmentStatus);
  };

  const saveDelivery = async () => {
    if (!edit) return;
    try {
      await commerceClient.updateOrder(edit.id, {
        deliveryAssignee: assignee || undefined,
        deliveryAddress: delAddress || undefined,
        deliveryNotes: delNotes || undefined,
        deliveryScheduledAt: scheduled || null,
        fulfillmentStatus: status,
      });
      toast.success("Delivery updated");
      setEdit(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const dispatchPartner = async () => {
    if (!edit) return;
    if (!delAddress.trim()) {
      toast.error("Set delivery address first");
      return;
    }
    try {
      await commerceClient.updateOrder(edit.id, {
        deliveryAssignee: assignee || undefined,
        deliveryAddress: delAddress.trim(),
        deliveryNotes: delNotes || undefined,
        deliveryScheduledAt: scheduled || null,
        fulfillmentStatus: status,
      });
      const res = await commerceClient.dispatchDelivery(edit.id);
      toast.success(
        res.partner
          ? `Dispatched · ${(res.partner as { partner?: string }).partner ?? "partner"}`
          : "Dispatched",
      );
      setEdit(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed");
    }
  };

  const columns: Column<ApiOrder>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Order",
        cell: (r) => <span className="font-mono text-xs">{r.id}</span>,
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
        key: "address",
        header: "Delivery",
        cell: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.deliveryAddress || r.deliveryAssignee || "—"}
          </span>
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
        cell: (r) => (
          <Badge variant={r.paymentStatus === "paid" ? "success" : "muted"}>{r.paymentStatus}</Badge>
        ),
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
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openDelivery(r);
                }}
              >
                Delivery
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
        description="Phone intake, fulfillment, and delivery from one list"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPhoneOpen((v) => !v)}>
              <Phone className="h-4 w-4" /> {phoneOpen ? "Hide phone form" : "New phone order"}
            </Button>
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
            <Button
              variant="outline"
              disabled={printing || !filteredOrders.length}
              onClick={() => void printFilteredDelivery()}
            >
              {printing
                ? "Preparing…"
                : `Print notes (${filteredOrders.filter((o) => o.fulfillmentStatus !== "cancelled").length})`}
            </Button>
          </div>
        }
      />

      {phoneOpen && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Phone className="h-4 w-4" /> Caller while on the phone
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Phone *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Delivery address *</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Search className="h-3.5 w-3.5" /> Add products
            </Label>
            <Input
              placeholder="Search SKU / name"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {matches.map((p) => (
                <Button key={p.id} size="sm" variant="secondary" type="button" onClick={() => addProduct(p)}>
                  {p.name} · {formatNPR(p.tradePrice)}
                </Button>
              ))}
            </div>
            {cart.length > 0 && (
              <ul className="text-sm space-y-1">
                {cart.map((l) => (
                  <li key={l.productId} className="flex items-center justify-between gap-2">
                    <span>
                      {l.name} × {l.qty}
                    </span>
                    <span className="flex items-center gap-2">
                      {formatNPR(l.price * l.qty)}
                      <button type="button" onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))}>
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button onClick={() => void placePhoneOrder()} disabled={saving}>
            {saving ? "Saving…" : `Place phone order · ${formatNPR(total)}`}
          </Button>
        </div>
      )}

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
        searchKeys={[(r) => r.id, (r) => r.customer?.name ?? "", (r) => r.channel, (r) => r.deliveryAddress ?? ""]}
        exportFilename="glamo-orders"
      />

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} className="max-w-md">
        <DialogContent onClose={() => setEdit(null)}>
          <DialogHeader>
            <DialogTitle>Delivery</DialogTitle>
            <DialogDescription>{edit?.customer?.name ?? edit?.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Assignee / driver</Label>
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={delAddress} onChange={(e) => setDelAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={delNotes} onChange={(e) => setDelNotes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Scheduled date</Label>
              <Input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="packed">packed</option>
                <option value="out_for_delivery">out_for_delivery</option>
                <option value="delivered">delivered</option>
              </Select>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                Close
              </Button>
              <Button variant="outline" onClick={() => void dispatchPartner()}>
                Send to partner
              </Button>
              <Button onClick={() => void saveDelivery()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
