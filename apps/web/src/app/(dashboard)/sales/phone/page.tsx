"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Phone, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { commerceClient, type ApiCustomer, type ApiOrder } from "@/lib/commerce-client";
import { useApiProducts } from "@/lib/use-api-products";
import { syncCallerToAppStore } from "@/lib/sync-caller";
import { formatNPR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadStoreBillPdf } from "@/lib/print-bill";

type Line = { productId: string; name: string; price: number; qty: number };

/**
 * Phone-call desk: capture caller details first, then optional line items.
 * Creates customer + phone-channel order (shows in Orders / Delivery).
 */
export default function PhoneOrderPage() {
  const { products, loading: productsLoading } = useApiProducts();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<ApiCustomer[]>([]);
  const [phoneOrders, setPhoneOrders] = useState<ApiOrder[]>([]);

  const reloadCustomers = useCallback(async () => {
    try {
      const { customers } = await commerceClient.listCustomers();
      setRecent(customers.filter((c) => c.sourceChannel === "phone" || c.phone).slice(0, 10));
    } catch {
      /* ignore */
    }
  }, []);

  const reloadPhoneOrders = useCallback(async () => {
    try {
      const { orders } = await commerceClient.listOrders({ channel: "phone" });
      setPhoneOrders(orders.slice(0, 8));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void reloadCustomers();
    void reloadPhoneOrders();
  }, [reloadCustomers, reloadPhoneOrders]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [products, search]);

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const addLine = (p: (typeof products)[0]) => {
    setCart((prev) => {
      const hit = prev.find((l) => l.productId === p.id);
      if (hit) {
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId: p.id, name: p.name, price: p.tradePrice, qty: 1 }];
    });
  };

  const saveCustomerOnly = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setSaving(true);
    try {
      const n = name.trim();
      const p = phone.trim();
      await commerceClient.createCustomer({
        name: n,
        phone: p,
        sourceChannel: "phone",
        deliveryAddress: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      syncCallerToAppStore({
        name: n,
        phone: p,
        area: address.trim() || "Phone",
      });
      toast.success("Caller saved · Customers & Phone order");
      await reloadCustomers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save customer");
    } finally {
      setSaving(false);
    }
  };

  const placeOrder = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Caller name and phone are required");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one product for a phone order");
      return;
    }
    if (!address.trim()) {
      toast.error("Delivery address is required");
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
          const product = products.find((p) => p.id === l.productId);
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
      toast.success(`Phone order recorded · ${order.id.slice(0, 8)}…`);
      setCart([]);
      setNotes("");
      setAddress("");
      await reloadCustomers();
      await reloadPhoneOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phone call order"
        description="Caller details first — saved as customer + phone order in Orders & Delivery"
        actions={
          <Link href="/orders">
            <Button variant="outline">View all orders</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Phone className="h-4 w-4" /> Caller details
          </div>
          <p className="text-xs text-muted-foreground">
            Fill while on the call. Saving creates/updates the customer record; placing an order
            also queues it for delivery.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Full name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
                autoFocus
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Phone *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Delivery address *</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Area, landmark, city"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Call notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="COD, shade, call before arrival…"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void saveCustomerOnly()}>
              Save caller only
            </Button>
            <Button type="button" disabled={saving} onClick={() => void placeOrder()}>
              {saving ? "Saving…" : "Place phone order + PDF"}
            </Button>
          </div>
          {recent.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Recent callers</p>
              <div className="flex flex-wrap gap-2">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary/40"
                    onClick={() => {
                      setName(c.name);
                      setPhone(c.phone ?? "");
                    }}
                  >
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium">Order lines</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={productsLoading ? "Loading products…" : "Search product to add…"}
            />
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addLine(p)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-primary/5"
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-primary">{formatNPR(p.tradePrice)}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No items yet</p>
            ) : (
              cart.map((l) => (
                <div key={l.productId} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-16"
                    value={l.qty}
                    onChange={(e) => {
                      const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setCart((prev) =>
                        prev.map((x) => (x.productId === l.productId ? { ...x, qty: n } : x)),
                      );
                    }}
                  />
                  <span className="w-20 text-right font-medium">{formatNPR(l.price * l.qty)}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setCart((prev) => prev.filter((x) => x.productId !== l.productId))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
            <div className={cn("flex justify-between border-t border-border pt-2 text-base font-semibold")}>
              <span>Total</span>
              <span className="text-primary">{formatNPR(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {phoneOrders.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-medium">Recent phone orders</p>
          <ul className="space-y-2 text-sm">
            {phoneOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                <span className="font-mono text-xs">{o.id.slice(0, 10)}…</span>
                <span>{o.customer?.name ?? "—"}{o.customer?.phone ? ` · ${o.customer.phone}` : ""}</span>
                <Badge variant="muted">{o.fulfillmentStatus}</Badge>
                <span className="font-medium text-primary">{formatNPR(Number(o.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
