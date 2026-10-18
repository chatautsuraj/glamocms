"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, PhoneCall } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CartLines, TotalsBlock } from "@/components/till/cart-lines";
import { CheckoutDialog } from "@/components/till/checkout-dialog";
import { CustomerPicker } from "@/components/till/customer-picker";
import { ProductSearch } from "@/components/till/product-search";
import { printBill } from "@/components/till/sale-complete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalogApi } from "@/lib/api/catalog";
import { deliveryApi } from "@/lib/api/delivery";
import type { BillData, NcmBranch, PosOrder, PosProduct, SaleChannel } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { findCachedByCode, upsertCachedProduct } from "@/lib/offline/catalog-cache";
import { newClientRef } from "@/lib/offline/queue";
import { buildLocalBill, buildSalePayload, cartTotals, lineFromProduct, usePhoneCart } from "@/lib/pos/cart";
import type { Tender } from "@/lib/pos/math";
import { sellCheck } from "@/lib/pos/sellable";
import { submitSale } from "@/lib/pos/submit-sale";
import { useCatalog } from "@/lib/pos/use-catalog";
import { companyFromStore } from "@/lib/print-bill";
import { printDeliveryNote } from "@/lib/print-delivery";
import { useSettingsStore } from "@/lib/settings-store";

/** html5-qrcode is heavy — load the camera scanner only when opened. */
const BarcodeCameraDialog = dynamic(() => import("@/components/barcode-camera-dialog").then((m) => m.BarcodeCameraDialog), { ssr: false });

export default function PhoneOrdersPage() {
  const cart = usePhoneCart();
  const { products } = useCatalog();
  const user = useAuthStore((s) => s.user);
  const store = useAuthStore((s) => s.store);
  const permissions = useAuthStore((s) => s.permissions);
  const canOverride = permissions.includes("pos.override");
  const canDelivery = permissions.includes("delivery.manage");
  const { vatRate, settings } = useSettingsStore();

  const [channel, setChannel] = useState<SaleChannel>("PHONE");
  const [deliver, setDeliver] = useState(true);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [branch, setBranch] = useState("");
  const [charge, setCharge] = useState("");
  const [branches, setBranches] = useState<NcmBranch[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ bill: BillData; order?: PosOrder } | null>(null);

  useEffect(() => {
    if (canDelivery) deliveryApi.branches().then(setBranches).catch(() => undefined);
  }, [canDelivery]);

  useEffect(() => {
    if (cart.customer?.address && !address) setAddress(cart.customer.address);
  }, [cart.customer, address]);

  const deliveryCharge = deliver ? Number(charge) || 0 : 0;
  const totals = useMemo(() => cartTotals(cart.lines, cart.discount, vatRate, deliveryCharge), [cart.lines, cart.discount, vatRate, deliveryCharge]);
  const customerOk = Boolean(cart.customer?.name?.trim() && cart.customer?.phone?.trim());
  const addressOk = !deliver || (address.trim().length > 2 && (city.trim() || branch));

  const add = (p: PosProduct, variantId: string | null) => {
    const key = `${p.id}:${variantId ?? ""}`;
    const inCart = usePhoneCart.getState().lines.find((l) => l.key === key)?.quantity ?? 0;
    const check = sellCheck(p, variantId, inCart, { allowNegativeStock: settings?.pos.allowNegativeStock });
    if (check.error) return void toast.error(check.error);
    if (check.warning) toast.warning(check.warning);
    usePhoneCart.getState().add(lineFromProduct(p, variantId));
  };

  const onCode = async (code: string) => {
    const local = await findCachedByCode(code);
    if (local && (local.variantId || !local.product.variants.length)) return add(local.product, local.variantId);
    try {
      const p = await catalogApi.lookup(code);
      await upsertCachedProduct(p);
      if (p.variants.length && !p.matchedVariantId) return void toast.message(`${p.name}: pick a shade from the list`);
      add(p, p.matchedVariantId ?? null);
    } catch (err) {
      toastError(err);
    }
  };

  const quoteRate = async () => {
    const destination = branch || city;
    if (!destination) return void toast.error("Choose a branch or enter the city first.");
    try {
      const rate = await deliveryApi.rate(destination, settings?.delivery.defaultDeliveryType || undefined);
      setCharge(String(rate.charge));
      toast.success(`NCM rate to ${rate.destination}: ${formatNPR(rate.charge)}`);
    } catch (err) {
      toastError(err);
    }
  };

  const place = async (tenders: Tender[]) => {
    if (!user || !store) return;
    setBusy(true);
    const state = usePhoneCart.getState();
    const paid = tenders.reduce((s, t) => s + t.amount, 0);
    const delivery = deliver
      ? { required: true, address: address.trim(), city: city.trim() || branch, branch: branch || undefined, charge: deliveryCharge, codAmount: Math.max(0, totals.total - paid) }
      : undefined;
    const customer = { ...state.customer, address: address.trim() || state.customer?.address };
    const payload = buildSalePayload({ clientRef: newClientRef(), lines: state.lines, discount: state.discount, tenders, customer, notes: state.notes, channel, delivery });
    const localBill = buildLocalBill({
      lines: state.lines, discount: state.discount, vatRate, tenders, customer, cashierName: user.name, store, footer: settings?.pos.receiptFooter,
      deliveryCharge, allowShortfall: deliver, channel,
    });
    try {
      const res = await submitSale(payload, localBill);
      setLast({ bill: res.bill, order: res.order });
      state.clear();
      setPayOpen(false);
      setAddress("");
      setCity("");
      setBranch("");
      setCharge("");
      toast.success(res.offline ? `Queued offline as ${res.bill.printableRef}` : `Order ${res.bill.printableRef} created`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Phone order desk" description="Take phone, WhatsApp and manual orders with delivery — created as CONFIRMED with cash on delivery unless prepaid." />
      {last && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <PhoneCall className="h-4 w-4 text-success" aria-hidden />
          <span>Order <strong className="font-mono">{last.bill.printableRef}</strong> · {formatNPR(last.bill.total)}{last.bill.due > 0 ? ` · COD ${formatNPR(last.bill.due)}` : ""}</span>
          <Button size="sm" variant="outline" onClick={() => printBill(last.bill)}>Print bill</Button>
          {last.order && store && <Button size="sm" variant="outline" onClick={() => printDeliveryNote(last.order!, companyFromStore(store))}>Delivery note</Button>}
          {last.order && <Link className="text-primary underline-offset-4 hover:underline" href={`/orders/${encodeURIComponent(last.order.id)}`}>Open order</Link>}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer & delivery</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Channel" className="w-40">
                  <Select value={channel} onChange={(e) => setChannel(e.target.value as SaleChannel)}>
                    <option value="PHONE">Phone</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="MANUAL">Manual</option>
                  </Select>
                </Field>
                <Button variant="outline" onClick={() => setCustomerOpen(true)} className="min-w-[220px] justify-start">
                  {cart.customer?.name ? `${cart.customer.name} · ${cart.customer.phone ?? "no phone"}` : "Find / add customer *"}
                </Button>
              </div>
              <CheckField label="Deliver with Nepal Can Move" checked={deliver} onChange={setDeliver} hint="Off = customer collects at the counter." />
              {deliver && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Delivery address *" className="sm:col-span-2"><Input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></Field>
                  <Field label="City / district *"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                  <Field label="NCM branch">
                    {branches.length ? (
                      <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
                        <option value="">Auto from city</option>
                        {branches.map((b) => <option key={b.code || b.name} value={b.name}>{b.name}{b.district ? ` — ${b.district}` : ""}</option>)}
                      </Select>
                    ) : <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Optional" />}
                  </Field>
                  <Field label="Delivery charge (Rs)">
                    <div className="flex gap-2">
                      <Input inputMode="numeric" value={charge} onChange={(e) => setCharge(e.target.value.replace(/\D/g, ""))} placeholder="0" />
                      {canDelivery && <Button type="button" variant="outline" onClick={quoteRate} aria-label="Get NCM rate"><Calculator className="h-4 w-4" /></Button>}
                    </div>
                  </Field>
                </div>
              )}
              <Field label="Order notes"><Textarea rows={2} value={cart.notes} onChange={(e) => cart.setNotes(e.target.value)} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Products</CardTitle></CardHeader>
            <CardContent><ProductSearch products={products} onPick={add} onCode={(c) => void onCode(c)} onCamera={() => setCameraOpen(true)} compact /></CardContent>
          </Card>
        </div>
        <Card className="xl:sticky xl:top-20 xl:self-start">
          <CardHeader><CardTitle className="text-base">Order</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CartLines lines={cart.lines} canOverride={canOverride} onQty={cart.setQty} onRemove={cart.remove} onLineDiscount={cart.setLineDiscount} onUnitPrice={cart.setUnitPrice} />
            <label className="flex items-center gap-2 text-sm">Order discount Rs
              <Input inputMode="numeric" className="h-10 w-24" value={cart.discount || ""} placeholder="0" onChange={(e) => cart.setDiscount(Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </label>
            <TotalsBlock subtotal={totals.subtotal} discount={totals.discount} vatAmount={totals.vatAmount} vatRate={vatRate} deliveryCharge={totals.deliveryCharge} total={totals.total} />
            {!customerOk && <p className="text-xs text-warning">Customer name and mobile are required.</p>}
            {!addressOk && <p className="text-xs text-warning">Delivery address and city/branch are required.</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant="outline" disabled={!cart.lines.length || !customerOk || !addressOk || busy || !deliver} onClick={() => void place([])}>
                {deliver ? "Place — COD" : "COD needs delivery"}
              </Button>
              <Button size="lg" disabled={!cart.lines.length || !customerOk || !addressOk || busy} onClick={() => setPayOpen(true)}>Take prepayment</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <CustomerPicker open={customerOpen} onOpenChange={setCustomerOpen} initial={cart.customer} onPick={cart.setCustomer} requireAddress={deliver} />
      <BarcodeCameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onDetected={(c) => void onCode(c)} />
      <CheckoutDialog open={payOpen} onOpenChange={setPayOpen} total={totals.total} hasNamedCustomer={customerOk} onNeedCustomer={() => setCustomerOpen(true)} onComplete={place} busy={busy} allowShortfall={deliver} title="Prepayment" />
    </div>
  );
}
