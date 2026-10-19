"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Calculator, Camera, CheckCircle2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CartLineRow } from "@/components/pos/cart-line";
import { PaymentDialog } from "@/components/pos/payment-dialog";
import { ShadePickerDialog } from "@/components/pos/shade-picker-dialog";
import { Totals } from "@/components/pos/totals";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, SwitchField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalogApi } from "@/lib/api/catalog";
import { customersApi } from "@/lib/api/customers";
import { deliveryApi } from "@/lib/api/delivery";
import type { BillData, Customer, NcmBranch, PosOrder, PosProduct, SaleChannel } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { digitsToInt, formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { findCachedByCode, upsertCachedProduct } from "@/lib/offline/catalog-cache";
import { newClientRef } from "@/lib/offline/queue";
import { useOfflineStore } from "@/lib/offline/sync-runner";
import { buildLocalBill, buildSalePayload, cartTotals, lineFromProduct, lineKey, usePhoneOrderCart } from "@/lib/pos/cart";
import { useEnabledMethods, usePosConfig, vatOf } from "@/lib/pos/config-store";
import { normalizeNepalMobile, validateOrderCustomer, type OrderCustomerErrors } from "@/lib/pos/customer";
import type { Tender } from "@/lib/pos/math";
import { searchProducts } from "@/lib/pos/search";
import { sellCheck } from "@/lib/pos/sellable";
import { submitSale } from "@/lib/pos/submit-sale";
import { useCatalog } from "@/lib/pos/use-catalog";
import { printBill, printDeliveryNotesFor } from "@/lib/print/print-sale";
import { useDefaultDeliveryType } from "@/lib/use-delivery-defaults";

/** html5-qrcode is heavy — load the camera scanner only when opened. */
const BarcodeCameraDialog = dynamic(() => import("@/components/barcode-camera-dialog").then((m) => m.BarcodeCameraDialog), { ssr: false });

type CustomerForm = { id?: string; name: string; phone: string; address: string; city: string };
const EMPTY_CUSTOMER: CustomerForm = { name: "", phone: "", address: "", city: "" };

export default function PhoneOrdersPage() {
  const lines = usePhoneOrderCart((s) => s.lines);
  const discount = usePhoneOrderCart((s) => s.discount);
  const notes = usePhoneOrderCart((s) => s.notes);
  const lastKey = usePhoneOrderCart((s) => s.lastKey);
  const addSeq = usePhoneOrderCart((s) => s.addSeq);
  const { products } = useCatalog();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canOverride = permissions.includes("pos.override");
  const canDelivery = permissions.includes("delivery.manage");
  const settingsHint = permissions.includes("settings.read");
  const config = usePosConfig((s) => s.config);
  const methods = useEnabledMethods();
  const vat = useMemo(() => vatOf(config), [config]);
  const defaultDeliveryType = useDefaultDeliveryType();

  const [channel, setChannel] = useState<SaleChannel>("PHONE");
  const [customer, setCustomer] = useState<CustomerForm>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<OrderCustomerErrors>({});
  const [matches, setMatches] = useState<Customer[]>([]);
  const [deliver, setDeliver] = useState(true);
  const [branch, setBranch] = useState("");
  const [charge, setCharge] = useState("");
  const [branches, setBranches] = useState<NcmBranch[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [shadeFor, setShadeFor] = useState<PosProduct | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ bill: BillData; order?: PosOrder } | null>(null);
  const online = useOfflineStore((s) => s.online);
  /** One idempotency key per order attempt, reused if the cashier retries after a timeout. */
  const checkoutRef = useRef<string | null>(null);
  useEffect(() => {
    checkoutRef.current = null;
  }, [lines, discount, customer, deliver, charge, branch, channel]);

  useEffect(() => {
    if (canDelivery) deliveryApi.branches().then(setBranches).catch(() => undefined);
  }, [canDelivery]);

  // Existing customer lookup by mobile number.
  const phoneDigits = normalizeNepalMobile(customer.phone);
  useEffect(() => {
    if (!online || phoneDigits.length < 6 || customer.id) {
      setMatches([]);
      return;
    }
    const t = window.setTimeout(() => customersApi.list({ q: phoneDigits }).then((r) => setMatches(r.items.slice(0, 4))).catch(() => setMatches([])), 300);
    return () => window.clearTimeout(t);
  }, [phoneDigits, online, customer.id]);

  const deliveryCharge = deliver ? digitsToInt(charge) : 0;
  const totals = useMemo(() => cartTotals(lines, discount, vat, deliveryCharge), [lines, discount, vat, deliveryCharge]);
  const results = useMemo(() => (deferredQuery.trim() ? searchProducts(products, deferredQuery).slice(0, 30) : []), [products, deferredQuery]);

  const actions = useMemo(() => {
    const s = usePhoneOrderCart.getState();
    return { setQty: s.setQty, bumpQty: s.bumpQty, remove: s.remove, setLineDiscount: s.setLineDiscount, setUnitPrice: s.setUnitPrice };
  }, []);

  const add = useCallback((p: PosProduct, variantId: string | null) => {
    const inCart = usePhoneOrderCart.getState().lines.find((l) => l.key === lineKey(p.id, variantId))?.quantity ?? 0;
    const check = sellCheck(p, variantId, inCart, { allowNegativeStock: config?.allowNegativeStock, online: useOfflineStore.getState().online });
    if (check.error) return void toast.error(check.error);
    if (check.warning) toast.warning(check.warning);
    usePhoneOrderCart.getState().add(lineFromProduct(p, variantId));
    setQuery("");
  }, [config?.allowNegativeStock]);

  const pick = (p: PosProduct) => (p.variants.length ? setShadeFor(p) : add(p, null));

  const onCode = async (code: string) => {
    const local = await findCachedByCode(code);
    if (local) return local.variantId || !local.product.variants.length ? add(local.product, local.variantId) : setShadeFor(local.product);
    try {
      const p = await catalogApi.lookup(code);
      await upsertCachedProduct(p);
      if (p.variants.length && !p.matchedVariantId) return setShadeFor(p);
      add(p, p.matchedVariantId ?? null);
    } catch (err) {
      toastError(err);
    }
  };

  const quoteRate = async () => {
    const destination = branch || customer.city.trim();
    if (!destination) return void toast.error("Choose an NCM branch or type the city first.");
    try {
      const rate = await deliveryApi.rate(destination, defaultDeliveryType || undefined);
      setCharge(String(rate.charge));
      toast.success(`Nepal Can Move to ${rate.destination}: ${formatNPR(rate.charge)}`);
    } catch (err) {
      toastError(err);
    }
  };

  const check = (): boolean => {
    const e = validateOrderCustomer(customer, { requireAddress: deliver });
    if (deliver && !customer.city.trim() && !branch && !e.address) e.address = "Add the city or choose an NCM branch.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fill in the customer details.");
      return false;
    }
    if (!usePhoneOrderCart.getState().lines.length) {
      toast.error("Add at least one product.");
      return false;
    }
    return true;
  };

  const place = async (tenders: Tender[]) => {
    if (busy) return;
    if (!user || !config) return void toast.error("Shop settings are still loading. Try again in a moment.");
    setBusy(true);
    const state = usePhoneOrderCart.getState();
    const paid = tenders.reduce((s, t) => s + t.amount, 0);
    const city = customer.city.trim() || branch;
    const address = [customer.address.trim(), customer.city.trim()].filter(Boolean).join(", ");
    const delivery = deliver
      ? { required: true, address: customer.address.trim(), city, branch: branch || undefined, charge: deliveryCharge, codAmount: Math.max(0, totals.total - paid) }
      : undefined;
    const saleCustomer = { id: customer.id, name: customer.name.trim(), phone: phoneDigits, address: address || undefined };
    checkoutRef.current ??= newClientRef();
    const payload = buildSalePayload({ clientRef: checkoutRef.current, lines: state.lines, discount: state.discount, tenders, customer: saleCustomer, notes: state.notes, channel, delivery });
    const localBill = buildLocalBill({
      lines: state.lines, discount: state.discount, vat, taxInvoice: config.taxInvoice, tenders, customer: saleCustomer, cashierName: user.name, store: config.store, footer: config.receiptFooter,
      deliveryCharge, allowShortfall: deliver, channel,
    });
    try {
      const res = await submitSale(payload, localBill);
      checkoutRef.current = null;
      setLast({ bill: res.bill, order: res.order });
      state.clear();
      setPayOpen(false);
      setCustomer(EMPTY_CUSTOMER);
      setErrors({});
      setBranch("");
      setCharge("");
      toast.success(res.offline ? `No internet. Order saved on this device as ${res.bill.printableRef}.` : `Order ${res.bill.printableRef} created`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const setField = (k: keyof CustomerForm, v: string) => {
    setCustomer((c) => ({ ...c, [k]: v, ...(k === "phone" ? { id: undefined } : {}) }));
    if (errors[k as keyof OrderCustomerErrors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Phone & WhatsApp orders" description="Take an order by phone, WhatsApp or in person for delivery. Customer name, mobile and address are needed." />
      {last && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
          <span>Order <strong className="font-mono">{last.bill.printableRef}</strong> · {formatNPR(last.bill.total)}{last.bill.due > 0 ? ` · ${formatNPR(last.bill.due)} to collect on delivery` : " · paid"}</span>
          <Button size="sm" variant="outline" onClick={() => void printBill(last.bill)}>Print bill</Button>
          {last.order && config && <Button size="sm" variant="outline" onClick={() => void printDeliveryNotesFor([last.order as PosOrder], config.store)}>Delivery note</Button>}
          {last.order && <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/orders/${encodeURIComponent(last.order.id)}`}>Open order</Link>}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mobile number *" error={errors.phone}>
                  <Input value={customer.phone} onChange={(e) => setField("phone", e.target.value)} inputMode="tel" autoComplete="off" placeholder="98XXXXXXXX" aria-invalid={Boolean(errors.phone)} />
                </Field>
                <Field label="Name *" error={errors.name}>
                  <Input value={customer.name} onChange={(e) => setField("name", e.target.value)} autoComplete="off" aria-invalid={Boolean(errors.name)} />
                </Field>
              </div>
              {matches.length > 0 && (
                <div className="rounded-lg border border-border">
                  <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">Existing customers with this number</p>
                  <ul className="divide-y divide-border">
                    {matches.map((c) => (
                      <li key={c.id}>
                        <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setCustomer({ id: c.id, name: c.name, phone: c.phone ?? customer.phone, address: c.address ?? "", city: "" }); setMatches([]); setErrors({}); }}>
                          <span className="font-medium">{c.name}</span>
                          <span className="truncate text-muted-foreground">{[c.phone, c.address].filter(Boolean).join(" · ")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <Field label="Order came by">
                  <Select value={channel} onChange={(e) => setChannel(e.target.value as SaleChannel)}>
                    <option value="PHONE">Phone call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="MANUAL">Other</option>
                  </Select>
                </Field>
                <SwitchField label="Deliver with Nepal Can Move" hint={deliver ? "We send it to the customer." : "Customer collects from the shop."} checked={deliver} onChange={setDeliver} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={deliver ? "Delivery address *" : "Address"} className="sm:col-span-2" error={errors.address}>
                  <Input value={customer.address} onChange={(e) => setField("address", e.target.value)} autoComplete="off" placeholder="Area, street, landmark" aria-invalid={Boolean(errors.address)} />
                </Field>
                {deliver && (
                  <>
                    <Field label="City / district"><Input value={customer.city} onChange={(e) => setField("city", e.target.value)} autoComplete="off" /></Field>
                    <Field label="NCM branch">
                      {branches.length ? (
                        <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
                          <option value="">Choose from city</option>
                          {branches.map((b) => <option key={b.code || b.name} value={b.name}>{b.name}{b.district ? `, ${b.district}` : ""}</option>)}
                        </Select>
                      ) : <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Optional" />}
                    </Field>
                    <Field label="Delivery charge (Rs)">
                      <div className="flex gap-2">
                        <Input inputMode="numeric" value={charge} onChange={(e) => setCharge(e.target.value.replace(/\D/g, ""))} placeholder="0" />
                        {canDelivery && <Button variant="outline" onClick={() => void quoteRate()} aria-label="Get Nepal Can Move rate" title="Get NCM rate"><Calculator className="h-4 w-4" /></Button>}
                      </div>
                    </Field>
                  </>
                )}
              </div>
              <Field label="Order notes"><Textarea rows={2} value={notes} onChange={(e) => usePhoneOrderCart.getState().setNotes(e.target.value)} placeholder="e.g. call before coming" /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Products</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search products or type a barcode</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    className="h-12 pl-9 text-base"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, brand, shade or barcode"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (results.length === 1) pick(results[0]);
                      else if (query.trim()) void onCode(query.trim()).then(() => setQuery(""));
                    }}
                  />
                </label>
                <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setCameraOpen(true)} aria-label="Scan with camera"><Camera className="h-5 w-5" /></Button>
              </div>
              {results.length > 0 && (
                <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border scrollbar-thin">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => pick(p)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                        <ProductImage src={p.imageUrl} name={p.name} className="h-10 w-10 shrink-0 border border-border" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{[p.brand, p.variants.length ? `${p.variants.length} shades` : null, `${p.stock} in stock`].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="tabular font-semibold">{formatNPR(p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {deferredQuery.trim() && !results.length && <p className="text-sm text-muted-foreground">No product matches. Press Enter to look up a barcode.</p>}
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-20 xl:self-start">
          <CardHeader><CardTitle>Order</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-0 pb-5">
            {lines.length ? (
              <ul className="divide-y divide-border border-y border-border">
                {lines.map((l) => (
                  <CartLineRow key={l.key} line={l} canOverride={canOverride} flash={l.key === lastKey ? addSeq : 0} onQty={actions.setQty} onBump={actions.bumpQty} onRemove={actions.remove} onLineDiscount={actions.setLineDiscount} onUnitPrice={actions.setUnitPrice} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Search or scan products to add them.</p>
            )}
            <div className="space-y-4 px-5">
              {canOverride && lines.length > 0 && (
                <label className="flex items-center gap-2 text-sm">Order discount Rs
                  <Input inputMode="numeric" className="h-10 w-24" value={discount || ""} placeholder="0" onChange={(e) => usePhoneOrderCart.getState().setDiscount(digitsToInt(e.target.value))} />
                </label>
              )}
              <Totals subtotal={totals.subtotal} discount={totals.discount} deliveryCharge={totals.deliveryCharge} vatAmount={totals.vatAmount} vat={vat} total={totals.total} />
              <div className="grid gap-2">
                {deliver && (
                  <Button size="lg" variant="brand" disabled={!lines.length || busy} onClick={() => check() && void place([])}>
                    {busy ? "Saving…" : `Place order · ${formatNPR(totals.total)} on delivery`}
                  </Button>
                )}
                <Button size="lg" variant={deliver ? "outline" : "brand"} disabled={!lines.length || busy} onClick={() => check() && setPayOpen(true)}>
                  {deliver ? "Customer pays now (all or part)" : "Take payment"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <ShadePickerDialog product={shadeFor} onClose={() => setShadeFor(null)} onPick={(p, v) => { setShadeFor(null); add(p, v); }} />
      <BarcodeCameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onDetected={(c) => void onCode(c)} />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={totals.total}
        methods={methods}
        initialMethod={methods.find((m) => m !== "CASH") ?? "CASH"}
        payments={config?.payments ?? null}
        onComplete={place}
        busy={busy}
        allowShortfall={deliver}
        title={deliver ? "Payment now" : "Take payment"}
        settingsHint={settingsHint}
      />
    </div>
  );
}
