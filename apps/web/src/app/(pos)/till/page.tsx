"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Keyboard, Lock, LockOpen, Percent, RefreshCw, User, X } from "lucide-react";
import { CartLines, TotalsBlock } from "@/components/till/cart-lines";
import { CheckoutDialog } from "@/components/till/checkout-dialog";
import { CustomerPicker } from "@/components/till/customer-picker";
import { ProductSearch } from "@/components/till/product-search";
import { SaleCompleteDialog, printBill } from "@/components/till/sale-complete-dialog";
import { CloseTillDialog, OpenTillDialog } from "@/components/till/till-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { catalogApi } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";
import type { BillData, PosProduct } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { findCachedByCode, upsertCachedProduct } from "@/lib/offline/catalog-cache";
import { newClientRef } from "@/lib/offline/queue";
import { useOfflineStore } from "@/lib/offline/sync-runner";
import { buildLocalBill, buildSalePayload, cartTotals, isNamedCustomer, lineFromProduct, useTillCart } from "@/lib/pos/cart";
import { discountPercent, type Tender } from "@/lib/pos/math";
import { isTypingTarget, WedgeDetector } from "@/lib/pos/scanner";
import { sellCheck } from "@/lib/pos/sellable";
import { submitSale } from "@/lib/pos/submit-sale";
import { useCatalog } from "@/lib/pos/use-catalog";
import { useTillShift } from "@/lib/pos/use-till";
import { useSettingsStore } from "@/lib/settings-store";

/** html5-qrcode is heavy — load the camera scanner only when opened. */
const BarcodeCameraDialog = dynamic(() => import("@/components/barcode-camera-dialog").then((m) => m.BarcodeCameraDialog), { ssr: false });

export default function TillPage() {
  const cart = useTillCart();
  const { products, loaded, reload } = useCatalog();
  const { shift, loading: shiftLoading, fromCache, update: setShift } = useTillShift();
  const online = useOfflineStore((s) => s.online);
  const user = useAuthStore((s) => s.user);
  const store = useAuthStore((s) => s.store);
  const canOverride = useAuthStore((s) => s.permissions.includes("pos.override"));
  const { vatRate, settings } = useSettingsStore();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [openTill, setOpenTill] = useState(false);
  const [closeTill, setCloseTill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<BillData | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const anyDialog = cameraOpen || customerOpen || payOpen || openTill || closeTill || Boolean(done);

  const totals = useMemo(() => cartTotals(cart.lines, cart.discount, vatRate), [cart.lines, cart.discount, vatRate]);
  const discPct = discountPercent(totals);
  const maxPct = settings?.pos.maxCashierDiscountPct;
  const overCap = !canOverride && maxPct !== undefined && discPct > maxPct + 1e-9;
  const tillReady = Boolean(shift);

  const addProduct = useCallback((p: PosProduct, variantId: string | null) => {
    const key = `${p.id}:${variantId ?? ""}`;
    const inCart = useTillCart.getState().lines.find((l) => l.key === key)?.quantity ?? 0;
    const check = sellCheck(p, variantId, inCart, { allowNegativeStock: settings?.pos.allowNegativeStock, online: useOfflineStore.getState().online });
    if (check.error) {
      toast.error(check.error);
      return;
    }
    if (check.warning) toast.warning(check.warning);
    const line = useTillCart.getState().add(lineFromProduct(p, variantId));
    toast.success(`${line.name}${line.variantName ? ` (${line.variantName})` : ""} × ${line.quantity}`, { duration: 1200 });
  }, [settings?.pos.allowNegativeStock]);

  /** Scanner / typed code: local catalog cache first, then GET /pos/lookup. */
  const resolveCode = useCallback(async (code: string) => {
    const local = await findCachedByCode(code);
    if (local) {
      if (local.product.variants.length > 0 && !local.variantId) {
        toast.message(`${local.product.name}: choose a shade`);
        searchRef.current?.focus();
        return;
      }
      addProduct(local.product, local.variantId);
      return;
    }
    if (!useOfflineStore.getState().online) {
      toast.error(`No product with code ${code} in the offline catalog.`);
      return;
    }
    try {
      const p = await catalogApi.lookup(code);
      await upsertCachedProduct(p);
      if (p.variants.length > 0 && !p.matchedVariantId) {
        toast.message(`${p.name}: choose a shade`);
        return;
      }
      addProduct(p, p.matchedVariantId ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) toast.error(`No product matches ${code}.`);
      else toastError(err);
    }
  }, [addProduct]);

  // USB HID scanner (keyboard wedge) when focus isn't in a text field + shortcuts.
  useEffect(() => {
    const detector = new WedgeDetector();
    const onKey = (e: KeyboardEvent) => {
      if (anyDialog) return;
      if (e.key === "F2" || (e.key === "/" && !isTypingTarget(e.target))) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "F4") { e.preventDefault(); setCustomerOpen(true); return; }
      if (e.key === "F8") {
        e.preventDefault();
        if (useTillCart.getState().lines.length && tillReady) setPayOpen(true);
        return;
      }
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const code = detector.push(e.key, performance.now());
      if (code) {
        e.preventDefault();
        void resolveCode(code);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyDialog, resolveCode, tillReady]);

  const complete = async (tenders: Tender[]) => {
    if (!user || !store) return;
    setBusy(true);
    const state = useTillCart.getState();
    const payload = buildSalePayload({
      clientRef: newClientRef(), lines: state.lines, discount: state.discount, tenders, customer: state.customer, notes: state.notes, shiftId: shift?.id, channel: "POS_COUNTER",
    });
    const localBill = buildLocalBill({
      lines: state.lines, discount: state.discount, vatRate, tenders, customer: state.customer, cashierName: user.name, store, footer: settings?.pos.receiptFooter, channel: "POS_COUNTER",
    });
    try {
      const result = await submitSale(payload, localBill);
      state.clear();
      setPayOpen(false);
      setDone(result.bill);
      if (result.offline) toast.warning(`Offline — sale queued as ${result.bill.printableRef}`);
      if (autoPrint) printBill(result.bill);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const closeDone = () => {
    setDone(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-2xl font-semibold">Till</h1>
        {shift ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-xs font-medium text-success" role="status">
            <LockOpen className="h-3.5 w-3.5" aria-hidden /> Till open · float {formatNPR(shift.openingFloat)}{fromCache ? " (cached)" : ""}
          </span>
        ) : (
          !shiftLoading && <span className="inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-xs font-medium text-warning" role="status"><Lock className="h-3.5 w-3.5" aria-hidden /> Till closed</span>
        )}
        {shift ? (
          <Button variant="outline" onClick={() => setCloseTill(true)} disabled={!online}>Close till</Button>
        ) : (
          <Button onClick={() => setOpenTill(true)} disabled={!online || shiftLoading}>Open till</Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => void reload()} aria-label="Refresh catalog"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {!shift && !shiftLoading && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm" role="alert">
          {online ? "Open the till with your opening float before taking counter sales." : "Offline and no open till cached on this device — connect to open the till."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardContent className="p-4">
            {loaded && !products.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{online ? "Loading the live catalog…" : "No catalog cached on this device yet — connect once to download it."}</p>
            ) : (
              <ProductSearch ref={searchRef} products={products} onPick={addProduct} onCode={(c) => void resolveCode(c)} onCamera={() => setCameraOpen(true)} />
            )}
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" aria-hidden /> Scanner works anywhere on this page · F2 search · F4 customer · F8 pay
            </p>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" className="flex-1 justify-start" onClick={() => setCustomerOpen(true)}>
                <User className="h-4 w-4" aria-hidden />
                <span className="truncate">{cart.customer?.name || cart.customer?.phone || "Walk-in customer"}</span>
                {(cart.customer?.khataBalance ?? 0) > 0 && <span className="ml-auto text-xs text-warning">Khata {formatNPR(cart.customer?.khataBalance ?? 0)}</span>}
              </Button>
              {cart.customer && <Button variant="ghost" size="icon" aria-label="Clear customer" onClick={() => cart.setCustomer(null)}><X className="h-4 w-4" /></Button>}
            </div>
            <div className="max-h-[45vh] overflow-y-auto">
              <CartLines lines={cart.lines} canOverride={canOverride} onQty={cart.setQty} onRemove={cart.remove} onLineDiscount={cart.setLineDiscount} onUnitPrice={cart.setUnitPrice} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Percent className="h-4 w-4 text-muted-foreground" aria-hidden />
                Bill discount Rs
                <Input inputMode="numeric" className="h-10 w-24" value={cart.discount || ""} placeholder="0" onChange={(e) => cart.setDiscount(Number(e.target.value.replace(/\D/g, "")) || 0)} />
              </label>
              {discPct > 0 && <span className={overCap ? "text-xs text-danger" : "text-xs text-muted-foreground"}>{discPct.toFixed(1)}%{overCap ? ` — above cashier limit ${maxPct}%, needs a manager` : ""}</span>}
            </div>
            <TotalsBlock subtotal={totals.subtotal} discount={totals.discount} vatAmount={totals.vatAmount} vatRate={vatRate} total={totals.total} />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} /> Print bill automatically
            </label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button variant="outline" size="lg" onClick={() => cart.clear()} disabled={!cart.lines.length}>Clear</Button>
              <Button size="lg" className="h-14 text-base" onClick={() => setPayOpen(true)} disabled={!cart.lines.length || !tillReady || overCap}>
                Pay {formatNPR(totals.total)} <span className="text-xs opacity-75">(F8)</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <BarcodeCameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onDetected={(c) => void resolveCode(c)} />
      <CustomerPicker open={customerOpen} onOpenChange={setCustomerOpen} initial={cart.customer} onPick={cart.setCustomer} />
      <CheckoutDialog open={payOpen} onOpenChange={setPayOpen} total={totals.total} hasNamedCustomer={isNamedCustomer(cart.customer)} onNeedCustomer={() => setCustomerOpen(true)} onComplete={complete} busy={busy} />
      <OpenTillDialog open={openTill} onOpenChange={setOpenTill} onOpened={(s) => { void setShift(s); toast.success("Till opened"); }} />
      <CloseTillDialog open={closeTill} onOpenChange={setCloseTill} shift={shift} onClosed={(s) => void setShift(s)} />
      <SaleCompleteDialog bill={done} onClose={closeDone} />
    </div>
  );
}
