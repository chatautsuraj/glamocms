"use client";
import { ProductPhoto } from "@/components/product-photo";

import { saleBlockReason } from "@/lib/cosmetics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  Camera,
  CreditCard,
  Minus,
  Package,
  Plus,
  QrCode,
  ScanBarcode,
  Search,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LazyBarcodeCameraDialog } from "@/lib/use-api-products";
import { calcVatIfEnabled, formatNPR, VAT_RATE } from "@/lib/format";
import {
  calcLineTotal,
  getWalkInCustomer,
  WALK_IN_CUSTOMER_ID,
} from "@/lib/store";
import { useApiProducts } from "@/lib/use-api-products";
import { commerceClient } from "@/lib/commerce-client";
import { paymentQrImageUrl, issueStoreBill } from "@/lib/print-bill";
import { syncCallerToAppStore } from "@/lib/sync-caller";
import { useActiveTenantId, useVatEnabled } from "@/lib/use-entitlements";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CartItem = {
  productId: string;
  name: string;
  sku: string;
  price: number;
  /** True when cashier typed a counter price (don't overwrite on customer change). */
  priceManual: boolean;
  discountPercent: number;
  qty: number;
};

type PaymentMethod = "CASH" | "CREDIT" | "QR_ESEWA" | "SPLIT";

export default function GallaPage() {
  const activeTenantId = useActiveTenantId();
  const vatEnabled = useVatEnabled();
  const { products, reload: reloadProducts } = useApiProducts();
  const walkIn = useMemo(
    () => getWalkInCustomer(activeTenantId ?? "glamo"),
    [activeTenantId]
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState(WALK_IN_CUSTOMER_ID);
  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [splitCash, setSplitCash] = useState("");
  const [splitQr, setSplitQr] = useState("");
  const [sessionSales, setSessionSales] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [paying, setPaying] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [scan, setScan] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [apiCustomers, setApiCustomers] = useState<
    Array<{
      id: string;
      name: string;
      phone: string | null;
      area?: string;
      outstanding?: number;
      creditLimit?: number;
      deliveryAddress?: string | null;
    }>
  >([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const reloadCustomers = useCallback(async () => {
    try {
      const { customers } = await commerceClient.listCustomers();
      setApiCustomers(
        customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          area: c.deliveryAddress || "Phone",
          outstanding: 0,
          creditLimit: 0,
          deliveryAddress: c.deliveryAddress,
        })),
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void reloadCustomers();
  }, [reloadCustomers]);

  const customerList = useMemo(() => [walkIn, ...apiCustomers], [walkIn, apiCustomers]);
  const customer =
    customerList.find((c) => c.id === customerId) ?? customerList[0];

  const gallaProducts = useMemo(
    () => products.filter((p) => p.galla !== false),
    [products]
  );

  const categories = useMemo(() => {
    const set = new Set(gallaProducts.map((p) => p.category));
    return ["All", ...Array.from(set).sort()];
  }, [gallaProducts]);

  useEffect(() => {
    setCustomerId(WALK_IN_CUSTOMER_ID);
    setCart([]);
    setSessionSales(0);
    setSessionCount(0);
    setCategory("All");
    setSearch("");
    setAddQty("1");
    setAddPrice("");
  }, [activeTenantId]);

  const filteredProducts = useMemo(() => {
    let list = gallaProducts;
    if (category !== "All") {
      list = list.filter((p) => p.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          (p.size || "").toLowerCase().includes(q) || (p.shade || "").toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)
    );
  }, [search, category, gallaProducts]);

  const subtotal = cart.reduce(
    (s, i) => s + calcLineTotal(i.qty, i.price, i.discountPercent),
    0
  );
  const taxableSubtotal = vatEnabled
    ? cart.reduce((s, i) => {
        const p = products.find((x) => x.id === i.productId);
        if (!p || !(p as { vatApplicable?: boolean }).vatApplicable) return s;
        return s + calcLineTotal(i.qty, i.price, i.discountPercent);
      }, 0)
    : 0;
  const { vat } = calcVatIfEnabled(taxableSubtotal, vatEnabled && taxableSubtotal > 0);
  const total = subtotal + vat;

  const stockOf = useCallback(
    (productId: string) => products.find((p) => p.id === productId)?.stock ?? 0,
    [products]
  );

  const parsedAddQty = useCallback(() => {
    const n = Math.floor(Number(addQty));
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [addQty]);

  const addToCart = useCallback(
    (product: (typeof products)[0], qtyOverride?: number) => {
      const blocked = saleBlockReason(product);
      if (blocked) { toast.error(blocked); return; }
      if (product.stock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }
      const qtyToAdd = qtyOverride ?? parsedAddQty();
      if (qtyToAdd < 1) {
        toast.error("Enter a quantity of 1 or more");
        return;
      }
      const listPrice = product.tradePrice;
      const typed = Number(addPrice);
      const useManual =
        addPrice.trim() !== "" && Number.isFinite(typed) && typed >= 0;
      if (useManual && typed > product.mrp) {
        toast.error(`Price cannot exceed MRP ${formatNPR(product.mrp)}`);
        return;
      }
      const unitPrice = useManual ? typed : listPrice;
      setCart((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          const nextQty = existing.qty + qtyToAdd;
          if (nextQty > product.stock) {
            toast.error(`Only ${product.stock} in stock`);
            return prev;
          }
          return prev.map((i) =>
            i.productId === product.id
              ? {
                  ...i,
                  qty: nextQty,
                  ...(useManual ? { price: unitPrice, priceManual: true } : {}),
                }
              : i
          );
        }
        if (qtyToAdd > product.stock) {
          toast.error(`Only ${product.stock} in stock`);
          return prev;
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: unitPrice,
            priceManual: useManual,
            discountPercent: 0,
            qty: qtyToAdd,
          },
        ];
      });
      setSearch("");
      setAddQty("1");
      setAddPrice("");
      scanRef.current?.focus();
    },
    [customerId, parsedAddQty, addPrice]
  );

  const applyScannedCode = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const q = code.toLowerCase();
      const hit =
        gallaProducts.find((p) => p.sku.toLowerCase() === q) ||
        gallaProducts.find((p) => p.barcode.toLowerCase() === q) ||
        gallaProducts.find((p) => p.sku.toLowerCase().includes(q));
      if (!hit) {
        toast.error(`No product for barcode ${code}`);
        setScan("");
        return;
      }
      addToCart(hit);
      setScan("");
      toast.success(`Scanned · ${hit.name}`);
      scanRef.current?.focus();
    },
    [gallaProducts, addToCart],
  );

  const handleScan = useCallback(() => {
    applyScannedCode(scan);
  }, [scan, applyScannedCode]);

  const saveQuickCustomer = async () => {
    if (!custName.trim() || !custPhone.trim()) {
      toast.error("Name and phone required");
      return;
    }
    try {
      const name = custName.trim();
      const phone = custPhone.trim();
      const address = custAddress.trim();
      const { customer: created } = await commerceClient.createCustomer({
        name,
        phone,
        // Phone channel so they appear under Phone order → Recent callers
        sourceChannel: "phone",
        deliveryAddress: address || undefined,
        notes: custNotes.trim() || undefined,
      });
      syncCallerToAppStore({
        name,
        phone,
        area: address || "Walk-in / Phone",
      });
      await reloadCustomers();
      setCustomerId(created.id);
      setCustOpen(false);
      setCustName("");
      setCustPhone("");
      setCustAddress("");
      setCustNotes("");
      toast.success("Caller saved · Customers & Phone order");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save customer");
    }
  };

  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.priceManual) return item;
        const product = products.find((p) => p.id === item.productId);
        return {
          ...item,
          price: product?.tradePrice ?? item.price,
        };
      })
    );
  }, [customerId, products]);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const nextQty = i.qty + delta;
          if (nextQty > stockOf(productId)) {
            toast.error(`Only ${stockOf(productId)} in stock`);
            return i;
          }
          return { ...i, qty: Math.max(0, nextQty) };
        })
        .filter((i) => i.qty > 0)
    );
  };

  const setQty = (productId: string, raw: string) => {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) return;
    if (n === 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    const max = stockOf(productId);
    if (n > max) {
      toast.error(`Only ${max} in stock`);
      setCart((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, qty: max } : i))
      );
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty: n } : i))
    );
  };

  const setCartPrice = (productId: string, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    const product = products.find((p) => p.id === productId);
    if (product && n > product.mrp) {
      toast.error(`Price cannot exceed MRP ${formatNPR(product.mrp)}`);
      setCart((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, price: product.mrp, priceManual: true } : i
        )
      );
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, price: n, priceManual: true } : i
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setSplitCash("");
    setSplitQr("");
    setSearch("");
    setAddQty("1");
    setAddPrice("");
    searchRef.current?.focus();
  };

  const completeSale = useCallback(async (opts?: { qrConfirmed?: boolean }) => {
    if (!customer) {
      toast.error("Select a customer");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    for (const item of cart) {
      if (item.qty > stockOf(item.productId)) {
        toast.error(`${item.name}: only ${stockOf(item.productId)} in stock`);
        return;
      }
      const product = products.find((p) => p.id === item.productId);
      if (product && item.price > product.mrp) {
        toast.error(`${item.name}: price cannot exceed MRP`);
        return;
      }
    }
    if (customer.id === WALK_IN_CUSTOMER_ID && payment === "CREDIT") {
      toast.error("Walk-in customer cannot take credit");
      return;
    }

    const cashAmt = Number(splitCash) || 0;
    const qrAmt = Number(splitQr) || 0;
    if (payment === "SPLIT" && Math.round(cashAmt + qrAmt) !== total) {
      toast.error(`Cash + QR must equal ${formatNPR(total)}`);
      return;
    }

    const needsQr = payment === "QR_ESEWA" || payment === "SPLIT";
    if (needsQr && !opts?.qrConfirmed && !qrOpen) {
      setQrOpen(true);
      return;
    }

    const isCredit = payment === "CREDIT";
    const billLines = cart.map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPrice: item.price,
      lineTotal: calcLineTotal(item.qty, item.price, item.discountPercent),
    }));
    setPaying(true);
    try {
      const { order } = await commerceClient.createOrder({
        channel: "store",
        paymentStatus: isCredit ? "unpaid" : "paid",
        fulfillmentStatus: isCredit ? "confirmed" : "fulfilled",
        customerId: customer.id !== WALK_IN_CUSTOMER_ID ? customer.id : undefined,
        customer: {
          name: customer.name,
          ...(customer.phone && customer.phone !== "—" ? { phone: customer.phone } : {}),
        },
        deliveryAddress:
          "deliveryAddress" in customer && customer.deliveryAddress
            ? customer.deliveryAddress
            : undefined,
        amount: total,
        items: cart.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.price,
          name: item.name,
        })),
      });
      setSessionSales((s) => s + total);
      setSessionCount((c) => c + 1);
      toast.success(`Sale complete — ${order.id.slice(0, 8)}…`, {
        description: `${cart.length} lines · ${formatNPR(total)} via ${payment}`,
      });
      issueStoreBill({
        orderId: order.id,
        customerName: customer.name,
        customerPhone: "phone" in customer ? (customer.phone ?? undefined) : undefined,
        method: payment,
        channel: "store",
        lines: billLines,
        subtotal,
        vat,
        total,
        vatEnabled: vatEnabled && vat > 0,
      });
      setQrOpen(false);
      clearCart();
      await reloadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the sale");
    } finally {
      setPaying(false);
    }
  }, [
    cart,
    payment,
    customer,
    total,
    subtotal,
    vat,
    vatEnabled,
    stockOf,
    splitCash,
    splitQr,
    products,
    reloadProducts,
    qrOpen,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        void completeSale(qrOpen ? { qrConfirmed: true } : undefined);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (qrOpen) setQrOpen(false);
        else clearCart();
      }
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [completeSale, qrOpen]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Glamo Counter"
        description="Scan or search · qty · optional price · F2 pay · Esc clear"
        actions={
          <Badge variant="success" className="gap-1 px-3 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            Session active
          </Badge>
        }
      />

      <div className="flex flex-wrap gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <span className="font-medium text-primary">
          <Zap className="mr-1 inline h-4 w-4" />
          Session: {sessionCount} bills
        </span>
        <Separator orientation="vertical" className="h-5" />
        <span>
          Session sales: <strong>{formatNPR(sessionSales)}</strong>
        </span>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-muted-foreground">
          {gallaProducts.length} counter products
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <ScanBarcode className="h-3.5 w-3.5" /> Scan barcode
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setCamOpen(true)}>
                <Camera className="h-3.5 w-3.5" /> Phone camera
              </Button>
            </div>
            <Input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="USB gun here · or use Phone camera · Enter adds"
              className="h-12 border-primary/30 bg-background font-mono text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan();
                }
              }}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, shade or brand… ( / )"
                className="h-12 pl-10 text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredProducts[0]) {
                    addToCart(filteredProducts[0]);
                  }
                }}
              />
            </div>
            <div className="flex gap-2 sm:w-auto">
              <div className="w-24">
                <Label className="sr-only">Qty to add</Label>
                <Input
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="h-12 text-center text-base font-semibold"
                  title="Quantity to add"
                  aria-label="Quantity to add"
                  placeholder="Qty"
                />
              </div>
              <div className="w-28">
                <Label className="sr-only">Manual price</Label>
                <Input
                  type="number"
                  min={0}
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  className="h-12 text-center text-base"
                  title="Optional counter price — leave blank to use list price"
                  aria-label="Manual price (optional)"
                  placeholder="Price"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave <strong>Price</strong> blank for list price, or type a counter rate before tapping a product.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto scrollbar-thin pr-1">
            <div className="grid gap-2 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredProducts.length === 0 ? (
                  <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                    No counter products match. Mark SKUs as counter/POS when adding products.
                  </p>
                ) : (
                  filteredProducts.map((p) => (
                    <motion.button
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      type="button"
                      onClick={() => addToCart(p)}
                      disabled={p.stock <= 0 || !!saleBlockReason(p)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50",
                        p.stock <= p.reorderAt && p.stock > 0 && "border-warning/40"
                      )}
                    >
                      <ProductPhoto src={p.image} name={p.name} className="h-20 w-20 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{p.name}</p>
                        {p.shade && !p.name.includes(p.shade) && <p className="text-xs text-primary">{p.shade}</p>}
                        <p className="text-xs text-muted-foreground">
                          {p.size ? `${p.size} · ` : ""}
                          {p.sku} · Stock: {p.stock}
                          {p.stock <= 0 ? " · OUT" : ""}{p.isTester ? " · TESTER" : saleBlockReason(p) ? " · EXPIRED" : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-primary">
                          {formatNPR(p.tradePrice)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          MRP {formatNPR(p.mrp)}
                        </p>
                      </div>
                    </motion.button>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-card lg:col-span-2">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">Customer</label>
              <Button type="button" size="sm" variant="outline" onClick={() => setCustOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Add caller
              </Button>
            </div>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {customerList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {"phone" in c && c.phone ? ` · ${c.phone}` : ""}
                  {c.area && c.area !== "Counter" ? ` — ${c.area}` : ""}
                </option>
              ))}
            </select>
            {customer && (customer.outstanding ?? 0) > 0 && (
              <p className="mt-1 text-xs text-warning">
                Outstanding: {formatNPR(customer.outstanding ?? 0)} /{" "}
                {formatNPR(customer.creditLimit ?? 0)}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {cart.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Cart empty — set qty (and optional price), then tap a product
              </p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                  <div
                    key={item.productId}
                    className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background">
                      {product?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => updateQty(item.productId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => setQty(item.productId, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="h-8 w-12 px-1 text-center text-sm font-medium"
                        aria-label={`Quantity for ${item.name}`}
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => updateQty(item.productId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <Input
                        type="number"
                        min={0}
                        value={item.price}
                        onChange={(e) => setCartPrice(item.productId, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="h-8 w-20 px-1 text-right text-sm font-medium"
                        aria-label={`Price for ${item.name}`}
                        title={item.priceManual ? "Manual counter price" : "List price — edit to override"}
                      />
                      {item.priceManual && (
                        <span className="text-[10px] text-primary">manual</span>
                      )}
                    </div>
                    <p className="w-16 shrink-0 text-right text-sm font-semibold">
                      {formatNPR(
                        calcLineTotal(item.qty, item.price, item.discountPercent)
                      )}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground hover:text-danger"
                      onClick={() =>
                        setCart((prev) =>
                          prev.filter((i) => i.productId !== item.productId)
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-border p-4">
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { id: "CASH" as const, icon: Banknote, label: "Cash" },
                  { id: "CREDIT" as const, icon: CreditCard, label: "Credit" },
                  { id: "QR_ESEWA" as const, icon: QrCode, label: "QR" },
                  { id: "SPLIT" as const, icon: Zap, label: "Split" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayment(m.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition-colors",
                    payment === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>

            {payment === "SPLIT" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Cash</Label>
                  <Input
                    type="number"
                    min={0}
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">QR</Label>
                  <Input
                    type="number"
                    min={0}
                    value={splitQr}
                    onChange={(e) => setSplitQr(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {(payment === "QR_ESEWA" || payment === "SPLIT") && total > 0 && (
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={paymentQrImageUrl(payment === "SPLIT" ? Number(splitQr) || total : total)}
                  alt="Payment QR"
                  className="h-40 w-40 rounded-xl bg-white p-2 shadow-sm"
                />
                <p className="text-sm font-medium text-primary">
                  Show QR · {formatNPR(payment === "SPLIT" ? Number(splitQr) || total : total)}
                </p>
                <p className="text-[11px] text-muted-foreground">Customer scans · then confirm pay</p>
              </button>
            )}

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatNPR(subtotal)}</span>
              </div>
              {vatEnabled && vat > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT ({(VAT_RATE * 100).toFixed(0)}% on taxable)</span>
                  <span>{formatNPR(vat)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatNPR(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={clearCart}>
                Clear (Esc)
              </Button>
              <Button onClick={() => void completeSale()} disabled={cart.length === 0 || paying}>
                {paying ? "Saving…" : payment === "QR_ESEWA" || payment === "SPLIT" ? "Confirm pay (F2)" : "Pay (F2)"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent
          className="max-w-sm text-center"
          onClose={() => setQrOpen(false)}
        >
          <DialogHeader className="text-center">
            <DialogTitle>Glamo Nepal · Pay by QR</DialogTitle>
            <DialogDescription>
              Ask the customer to scan · {formatNPR(payment === "SPLIT" ? Number(splitQr) || total : total)}
            </DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={paymentQrImageUrl(payment === "SPLIT" ? Number(splitQr) || total : total)}
            alt="Payment QR code"
            className="mx-auto h-64 w-64 rounded-2xl bg-white p-3 shadow-md"
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setQrOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={paying}
              onClick={() => void completeSale({ qrConfirmed: true })}
            >
              {paying ? "Saving…" : "Paid — print bill"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LazyBarcodeCameraDialog
        open={camOpen}
        onOpenChange={setCamOpen}
        onDetected={applyScannedCode}
      />

      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent onClose={() => setCustOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add caller / walk-up customer</DialogTitle>
            <DialogDescription>
              Save name + phone for this sale. Delivery address is optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={custName} onChange={(e) => setCustName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Phone *</Label>
              <Input
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1">
              <Label>Delivery address (optional)</Label>
              <Input
                value={custAddress}
                onChange={(e) => setCustAddress(e.target.value)}
                placeholder="Area, landmark, city"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                value={custNotes}
                onChange={(e) => setCustNotes(e.target.value)}
                placeholder="COD, call before arrival…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCustOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveQuickCustomer()}>Save &amp; select</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
