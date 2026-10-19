"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Keyboard, MoreVertical, RefreshCw, ScanBarcode, Search, ShoppingBag, Volume2, VolumeX, Wallet, X } from "lucide-react";
import { CartPanel, type CartActions } from "@/components/pos/cart-panel";
import { CashDrawerDialog } from "@/components/pos/cash-drawer-dialog";
import { PaymentDialog } from "@/components/pos/payment-dialog";
import { ProductGrid } from "@/components/pos/product-grid";
import { SaleCompleteDialog } from "@/components/pos/sale-complete-dialog";
import { ShadePickerDialog } from "@/components/pos/shade-picker-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, isModalOpen } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { catalogApi } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";
import type { BillData, PaymentMethod, PosProduct } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { findCachedByCode, upsertCachedProduct } from "@/lib/offline/catalog-cache";
import { newClientRef } from "@/lib/offline/queue";
import { useOfflineStore } from "@/lib/offline/sync-runner";
import { buildLocalBill, buildSalePayload, cartTotals, lineFromProduct, lineKey, usePosCart } from "@/lib/pos/cart";
import { useEnabledMethods, usePosConfig, vatOf } from "@/lib/pos/config-store";
import { discountPercent, type Tender } from "@/lib/pos/math";
import { playScanSound, scanSoundEnabled, setScanSoundEnabled } from "@/lib/pos/scan-sound";
import { isTypingTarget } from "@/lib/pos/scanner";
import { ALL_CATEGORIES, categoriesOf, searchProducts } from "@/lib/pos/search";
import { sellCheck } from "@/lib/pos/sellable";
import { submitSale } from "@/lib/pos/submit-sale";
import { useBarcodeScanner } from "@/lib/pos/use-barcode-scanner";
import { useCashDrawer } from "@/lib/pos/use-cash-drawer";
import { useCatalog } from "@/lib/pos/use-catalog";
import { preloadPrinting, printBill } from "@/lib/print/print-sale";
import { cn } from "@/lib/utils";

/** html5-qrcode is heavy — load the camera scanner only when opened. */
const BarcodeCameraDialog = dynamic(() => import("@/components/barcode-camera-dialog").then((m) => m.BarcodeCameraDialog), { ssr: false });

const AUTO_PRINT_KEY = "glamo-pos:auto-print";
/** Touch screens: don't pop the on-screen keyboard; the scanner works without focus anyway. */
const focusSearch = (el: HTMLInputElement | null) => {
  if (el && !window.matchMedia("(pointer: coarse)").matches) el.focus();
};

/** A typed (not scanned) code + Enter is looked up when it looks like a barcode/SKU. */
const LOOKS_LIKE_CODE = /^[A-Za-z0-9._\-/+]{4,64}$/;

export default function PosPage() {
  const lines = usePosCart((s) => s.lines);
  const discount = usePosCart((s) => s.discount);
  const customer = usePosCart((s) => s.customer);
  const lastKey = usePosCart((s) => s.lastKey);
  const addSeq = usePosCart((s) => s.addSeq);
  const { products, loaded, reload } = useCatalog();
  const { drawer, update: setDrawer } = useCashDrawer();
  const online = useOfflineStore((s) => s.online);
  const syncing = useOfflineStore((s) => s.syncing);
  const user = useAuthStore((s) => s.user);
  const canOverride = useAuthStore((s) => s.permissions.includes("pos.override"));
  const settingsHint = useAuthStore((s) => s.permissions.includes("settings.read"));
  const config = usePosConfig((s) => s.config);
  const methods = useEnabledMethods();
  const vat = useMemo(() => vatOf(config), [config]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const deferredQuery = useDeferredValue(query);
  const [shadeFor, setShadeFor] = useState<PosProduct | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartSheet, setCartSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<BillData | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [sound, setSound] = useState(true);
  const [announce, setAnnounce] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  /** One idempotency key per checkout: a retry after a timeout can't create a second sale. */
  const checkoutRef = useRef<string | null>(null);

  useEffect(() => {
    setAutoPrint(window.localStorage.getItem(AUTO_PRINT_KEY) === "on");
    setSound(scanSoundEnabled());
    focusSearch(searchRef.current);
    // Load the bill printer code while online so printing keeps working offline.
    const idle = window.setTimeout(preloadPrinting, 1500);
    return () => window.clearTimeout(idle);
  }, []);

  const anyDialog = Boolean(shadeFor) || cameraOpen || Boolean(payMethod) || drawerOpen || cartSheet || Boolean(done);

  const totals = useMemo(() => cartTotals(lines, discount, vat), [lines, discount, vat]);
  const maxPct = config?.maxCashierDiscountPct;
  const discPct = discountPercent(totals);
  const discountProblem = !canOverride && maxPct !== undefined && discPct > maxPct + 1e-9 ? `That is ${discPct.toFixed(1)}% off. Your limit is ${maxPct}%. Ask a manager.` : null;
  const customerRequired = Boolean(config?.requireCustomerForCounter);
  const canCharge = lines.length > 0 && !discountProblem && !(customerRequired && !(customer?.phone || customer?.id));

  const categories = useMemo(() => categoriesOf(products), [products]);
  const results = useMemo(() => searchProducts(products, deferredQuery, category), [products, deferredQuery, category]);
  useEffect(() => {
    checkoutRef.current = null; // the sale changed → it's a different checkout
  }, [lines, discount, customer]);

  const inCart = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity);
    return m;
  }, [lines]);

  const allowNegative = Boolean(config?.allowNegativeStock);
  /** +1 respects stock like adding does (online, unless selling below zero is allowed). */
  const bumpQty = useCallback((key: string, delta: number) => {
    const line = usePosCart.getState().lines.find((l) => l.key === key);
    if (!line) return;
    if (delta > 0 && line.trackInventory && line.quantity + delta > line.stock && !allowNegative && useOfflineStore.getState().online) {
      playScanSound("error");
      toast.error(`Only ${Math.max(0, line.stock)} of ${line.name} in stock.`);
      return;
    }
    usePosCart.getState().bumpQty(key, delta);
  }, [allowNegative]);

  const actions: CartActions = useMemo(() => {
    const s = usePosCart.getState();
    return { setQty: s.setQty, bumpQty, remove: s.remove, setLineDiscount: s.setLineDiscount, setUnitPrice: s.setUnitPrice, setDiscount: s.setDiscount, setCustomer: s.setCustomer };
  }, [bumpQty]);

  const addProduct = useCallback((p: PosProduct, variantId: string | null, source: "scan" | "tap") => {
    const inCartQty = usePosCart.getState().lines.find((l) => l.key === lineKey(p.id, variantId))?.quantity ?? 0;
    const check = sellCheck(p, variantId, inCartQty, { allowNegativeStock: config?.allowNegativeStock, online: useOfflineStore.getState().online });
    if (check.error) {
      playScanSound("error");
      toast.error(check.error);
      return;
    }
    if (check.warning) toast.warning(check.warning);
    const line = usePosCart.getState().add(lineFromProduct(p, variantId));
    if (source === "scan") playScanSound("ok");
    setAnnounce(`Added ${line.name}${line.variantName ? ` ${line.variantName}` : ""}. ${line.quantity} in this sale.`);
  }, [config?.allowNegativeStock]);

  const pickTile = useCallback((p: PosProduct) => {
    if (p.variants.length > 0) setShadeFor(p);
    else addProduct(p, null, "tap");
  }, [addProduct]);

  /** Scanner / typed code: this device's catalog first, then GET /pos/lookup. */
  const resolveCode = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const local = await findCachedByCode(code);
    if (local) {
      if (local.product.variants.length > 0 && !local.variantId) {
        playScanSound("ok");
        setShadeFor(local.product);
        return;
      }
      addProduct(local.product, local.variantId, "scan");
      return;
    }
    if (!useOfflineStore.getState().online) {
      playScanSound("error");
      toast.error(`No product with barcode ${code} on this device.`);
      return;
    }
    try {
      const p = await catalogApi.lookup(code);
      await upsertCachedProduct(p);
      if (p.variants.length > 0 && !p.matchedVariantId) {
        playScanSound("ok");
        setShadeFor(p);
        return;
      }
      addProduct(p, p.matchedVariantId ?? null, "scan");
    } catch (err) {
      playScanSound("error");
      if (err instanceof ApiError && err.status === 404) toast.error(`No product with barcode ${code}.`);
      else toastError(err);
    }
  }, [addProduct]);

  /**
   * Route a scan by what is on screen: normal → add; shade picker → pick that
   * shade; "sale complete" → start the next sale with it; any other dialog
   * (payment, cash drawer, customer…) → ignore, so a barcode never ends up
   * typed into a cash or phone field.
   */
  const onScan = (code: string) => {
    if (shadeFor) {
      const needle = code.trim().toUpperCase();
      const v = shadeFor.variants.find((x) => x.barcode?.toUpperCase() === needle || x.sku?.toUpperCase() === needle);
      if (v) {
        setShadeFor(null);
        addProduct(shadeFor, v.id, "scan");
      } else {
        playScanSound("error");
        toast.error("That barcode is not one of these shades.");
      }
      return;
    }
    if (done) {
      newSale();
      void resolveCode(code);
      return;
    }
    if (isModalOpen() && !cartSheet) {
      playScanSound("error");
      toast.error(payMethod ? "Finish or close the payment first, then scan." : "Close this window first, then scan.");
      return;
    }
    void resolveCode(code);
  };
  const scanner = useBarcodeScanner({ enabled: !cameraOpen, onScan });

  const openPayment = useCallback((method: PaymentMethod) => {
    if (!usePosCart.getState().lines.length) return;
    setCartSheet(false);
    setPayMethod(method);
  }, []);

  // Shortcuts: F2 search · F4 charge · Esc clear search · +/- change the last item.
  const canChargeRef = useRef(canCharge);
  canChargeRef.current = canCharge;
  useEffect(() => {
    if (anyDialog) return;
    let pending: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen()) return; // e.g. the customer dialog
      if (pending !== null) {
        window.clearTimeout(pending);
        pending = null;
      }
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (canChargeRef.current) openPayment("CASH");
        return;
      }
      if (e.key === "Escape" && e.target === searchRef.current && searchRef.current?.value) {
        setQuery("");
        return;
      }
      if ((e.key === "+" || e.key === "-") && !isTypingTarget(e.target) && !e.ctrlKey && !e.metaKey) {
        const key = usePosCart.getState().lastKey;
        if (!key || scanner.isScanning()) return;
        const delta = e.key === "+" ? 1 : -1;
        // Wait a beat: a scanner typing "GLM-…" sends "-" mid-code and the next key cancels this.
        pending = window.setTimeout(() => {
          pending = null;
          bumpQty(key, delta);
        }, 90);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (pending !== null) window.clearTimeout(pending);
    };
  }, [anyDialog, openPayment, scanner, bumpQty]);

  const onSearchEnter = () => {
    const q = query.trim();
    if (!q) return;
    const upper = q.toUpperCase();
    const exact = products.find((p) => p.codes.includes(upper));
    // Fresh results: the grid's deferred list can lag behind fast typing.
    const fresh = exact ? [] : searchProducts(products, q, category);
    if (exact) void resolveCode(q);
    else if (fresh.length === 1) pickTile(fresh[0]);
    else if (LOOKS_LIKE_CODE.test(q) && !fresh.length) void resolveCode(q);
    else return;
    setQuery("");
  };

  const complete = async (tenders: Tender[]) => {
    if (submitting.current) return;
    if (!user || !config) {
      toast.error("Shop settings are still loading. Try again in a moment.");
      void usePosConfig.getState().refresh();
      return;
    }
    submitting.current = true;
    setBusy(true);
    const state = usePosCart.getState();
    checkoutRef.current ??= newClientRef();
    const payload = buildSalePayload({ clientRef: checkoutRef.current, lines: state.lines, discount: state.discount, tenders, customer: state.customer, shiftId: drawer?.id, channel: "POS_COUNTER" });
    const localBill = buildLocalBill({
      lines: state.lines, discount: state.discount, vat, taxInvoice: config.taxInvoice, tenders, customer: state.customer, cashierName: user.name, store: config.store, footer: config.receiptFooter, channel: "POS_COUNTER",
    });
    try {
      const result = await submitSale(payload, localBill);
      checkoutRef.current = null;
      state.clear();
      setPayMethod(null);
      setDone(result.bill);
      if (result.offline) toast.warning(`No internet. Sale saved on this device as ${result.bill.printableRef}.`);
      if (autoPrint) void printBill(result.bill);
    } catch (err) {
      playScanSound("error");
      toastError(err);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const clearSale = () => {
    const snapshot = usePosCart.getState();
    const saved = { lines: snapshot.lines, customer: snapshot.customer, discount: snapshot.discount, notes: snapshot.notes, lastKey: snapshot.lastKey };
    snapshot.clear();
    toast("Sale cleared", { action: { label: "Undo", onClick: () => usePosCart.setState(saved) }, duration: 6000 });
    focusSearch(searchRef.current);
  };

  const newSale = () => {
    setDone(null);
    window.setTimeout(() => focusSearch(searchRef.current), 0);
  };

  const toggle = (key: string, value: boolean, set: (v: boolean) => void) => {
    window.localStorage.setItem(key, value ? "on" : "off");
    set(value);
  };

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const cartPanel = (
    <CartPanel
      lines={lines}
      lastKey={lastKey}
      addSeq={addSeq}
      totals={totals}
      vat={vat}
      discount={discount}
      customer={customer}
      canOverride={canOverride}
      discountProblem={discountProblem}
      customerRequired={customerRequired}
      methods={methods}
      actions={actions}
      onClear={clearSale}
      onCharge={openPayment}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label="Products" className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-2 border-b border-border bg-background px-3 pb-2 pt-3 sm:px-4">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Scan a barcode or search products</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSearchEnter();
                  }
                }}
                placeholder="Search or scan…"
                className="h-14 w-full rounded-full border-2 border-input bg-card pl-12 pr-12 text-base font-medium shadow-card placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              {query && (
                <button type="button" aria-label="Clear search" className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>
                  <X className="h-5 w-5" />
                </button>
              )}
            </label>
            <Button variant="outline" size="icon" className="h-14 w-14 shrink-0" onClick={() => setCameraOpen(true)} aria-label="Scan with camera">
              <Camera className="h-6 w-6" />
            </Button>
            <DropdownMenu
              trigger={(p) => (
                <Button {...p} variant="ghost" size="icon" className="h-14 w-11 shrink-0" aria-label="POS options">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              )}
            >
              <DropdownMenuItem onClick={() => setDrawerOpen(true)}>
                <Wallet className="h-4 w-4" aria-hidden /> Cash drawer{drawer ? " · count at end of day" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggle(AUTO_PRINT_KEY, !autoPrint, setAutoPrint)} keepOpen>
                <span aria-hidden className={cn("h-4 w-4 rounded border-2", autoPrint ? "border-success bg-success" : "border-input")} /> Print bill after each sale
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setScanSoundEnabled(!sound); setSound(!sound); }} keepOpen>
                {sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />} Scan sound {sound ? "on" : "off"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void reload()}>
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} aria-hidden /> Refresh products
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
          {categories.length > 1 && (
            <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:-mx-4 sm:px-4" role="group" aria-label="Category">
              {[{ name: ALL_CATEGORIES, count: products.length }, ...categories].map((c) => {
                const active = c.name === category;
                return (
                  <button
                    key={c.name || "all"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c.name)}
                    className={cn(
                      "h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-ink bg-ink text-background dark:border-foreground dark:bg-foreground" : "border-border bg-card hover:border-rose",
                    )}
                  >
                    {c.name || "All"} <span className={cn("tabular ml-1 text-xs", active ? "opacity-80" : "text-muted-foreground")}>{c.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-thin sm:px-4">
          {loaded && products.length > 0 && <p role="status" aria-live="polite" aria-atomic="true" className="mb-3 text-sm text-muted-foreground">{results.length} {results.length === 1 ? "product" : "products"}{deferredQuery.trim() ? ` matching “${deferredQuery.trim()}”` : category ? ` in ${category}` : ""}{(query || category) && <button type="button" className="ml-2 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4" onClick={() => { setQuery(""); setCategory(ALL_CATEGORIES); searchRef.current?.focus(); }}>Clear filters</button>}</p>}
          {!loaded ? (
            <div className="grid grid-cols-2 gap-3 @min-[520px]:grid-cols-3 @min-[760px]:grid-cols-4" role="status" aria-label="Loading products">
              {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
            </div>
          ) : !products.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ScanBarcode className="h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="font-semibold">{online ? "Downloading products…" : "No products on this device yet"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{online ? "This takes a few seconds the first time. Scanning already works." : "Connect to the internet once so the product list can be saved for offline selling."}</p>
              {online && <Button variant="outline" onClick={() => void reload()} disabled={syncing}><RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} aria-hidden /> Try again</Button>}
            </div>
          ) : (
            <ProductGrid key={`${category}|${deferredQuery}`} products={results} inCart={inCart} onPick={pickTile} query={deferredQuery} emptyHint="Check the spelling, or scan the barcode instead." />
          )}
        </div>

        <p className="hidden items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground lg:flex">
          <Keyboard className="h-3.5 w-3.5" aria-hidden />
          <span>Scanner works anywhere</span>
          <span><kbd className="rounded border border-border px-1">F2</kbd> search</span>
          <span><kbd className="rounded border border-border px-1">F4</kbd> charge</span>
          <span><kbd className="rounded border border-border px-1">+</kbd> / <kbd className="rounded border border-border px-1">−</kbd> last item</span>
          <span><kbd className="rounded border border-border px-1">Esc</kbd> close</span>
        </p>
      </section>

      <aside className="hidden min-h-0 border-l border-border md:flex md:flex-col">{cartPanel}</aside>

      {/* Phones: sale summary bar + full-height sheet. */}
      <div className="border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <Button variant={lines.length ? "brand" : "outline"} size="xl" className="w-full justify-between" onClick={() => setCartSheet(true)}>
          <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" aria-hidden /> {itemCount ? `${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Sale is empty"}</span>
          <span className="tabular">{formatNPR(totals.total)}</span>
        </Button>
      </div>
      <Dialog open={cartSheet} onOpenChange={setCartSheet} label="Current sale" className="h-[92dvh] max-w-lg">
        <DialogContent onClose={() => setCartSheet(false)} className="flex h-full flex-col overflow-hidden p-0 sm:p-0">
          <div className="min-h-0 flex-1 pt-12">{cartPanel}</div>
        </DialogContent>
      </Dialog>

      <p className="sr-only" aria-live="polite">{announce}</p>

      <ShadePickerDialog product={shadeFor} onClose={() => setShadeFor(null)} onPick={(p, v) => { setShadeFor(null); addProduct(p, v, "tap"); }} />
      <BarcodeCameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onDetected={(c) => void resolveCode(c)} />
      <PaymentDialog
        open={Boolean(payMethod)}
        onOpenChange={(o) => !o && setPayMethod(null)}
        total={totals.total}
        methods={methods}
        initialMethod={payMethod ?? "CASH"}
        payments={config?.payments ?? null}
        onComplete={complete}
        busy={busy}
        settingsHint={settingsHint}
      />
      <CashDrawerDialog open={drawerOpen} onOpenChange={setDrawerOpen} drawer={drawer} onChange={(d) => void setDrawer(d)} />
      <SaleCompleteDialog bill={done} onClose={newSale} />
    </div>
  );
}
