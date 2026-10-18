"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CodeFields, codeFieldErrors, type CodeErrors } from "@/components/products/code-fields";
import { PhotoManager } from "@/components/products/photo-manager";
import { TaxonomySelect } from "@/components/products/taxonomy-select";
import { VariantManager } from "@/components/products/variant-manager";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { catalogApi } from "@/lib/api/catalog";
import type { PosImage, PosProduct, PosProductWrite } from "@/lib/api/types";
import { useTaxonomy } from "@/lib/catalog-taxonomy";
import { toastError } from "@/lib/notify";
import { upsertCachedProduct } from "@/lib/offline/catalog-cache";

type Form = {
  name: string; sku: string; barcode: string; description: string; categoryId: string; brandId: string;
  basePrice: string; salePrice: string; mrp: string; costPrice: string; stock: string; lowStockThreshold: string;
  vatApplicable: boolean; posVisible: boolean; isActive: boolean; trackInventory: boolean;
  shade: string; batch: string; expiry: string; tester: boolean;
};

type Errors = CodeErrors & { name?: string; categoryId?: string; basePrice?: string };

const empty: Form = {
  name: "", sku: "", barcode: "", description: "", categoryId: "", brandId: "", basePrice: "", salePrice: "", mrp: "", costPrice: "", stock: "0",
  lowStockThreshold: "5", vatApplicable: true, posVisible: true, isActive: true, trackInventory: true, shade: "", batch: "", expiry: "", tester: false,
};

function fromProduct(p: PosProduct): Form {
  return {
    name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", description: p.description ?? "", categoryId: p.categoryId ?? "", brandId: p.brandId ?? "",
    basePrice: String(p.basePrice ?? ""), salePrice: p.salePrice != null ? String(p.salePrice) : "", mrp: p.mrp != null ? String(p.mrp) : "",
    costPrice: p.costPrice != null ? String(p.costPrice) : "", stock: String(p.stock), lowStockThreshold: String(p.lowStockThreshold),
    vatApplicable: p.vatApplicable, posVisible: p.posVisible, isActive: p.isActive, trackInventory: p.trackInventory ?? true,
    shade: p.attributes?.shade ?? "", batch: p.attributes?.batch ?? "", expiry: p.attributes?.expiry ?? "", tester: Boolean(p.attributes?.tester),
  };
}

const money = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));
const digits = (v: string) => v.replace(/\D/g, "");

/**
 * Add / edit a product from the POS: details, prices, barcode (Generate),
 * photos and shades. A new product is saved first, then photos and shades can
 * be added in the other tabs.
 */
export function ProductDialog({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; product: PosProduct | null; onSaved: (p: PosProduct) => void }) {
  const [current, setCurrent] = useState<PosProduct | null>(product);
  const [tab, setTab] = useState("details");
  const [f, setF] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent(product);
    setF(product ? fromProduct(product) : empty);
    setErrors({});
    setTab("details");
    void useTaxonomy.getState().load();
  }, [open, product]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const publish = (p: PosProduct) => {
    setCurrent(p);
    void upsertCachedProduct(p).catch(() => undefined);
    onSaved(p);
  };

  const submit = async () => {
    const basePrice = money(f.basePrice);
    const salePrice = money(f.salePrice);
    const next: Errors = {};
    if (!f.name.trim()) next.name = "Enter the product name.";
    if (!f.categoryId) next.categoryId = "Choose a category (or add one with +).";
    if (!basePrice || basePrice <= 0) next.basePrice = "Enter the selling price.";
    if (basePrice && salePrice !== null && salePrice >= basePrice) next.salePrice = "Sale price must be lower than the selling price.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const attributes = { shade: f.shade.trim() || undefined, batch: f.batch.trim() || undefined, expiry: f.expiry || undefined, tester: f.tester || undefined };
    const body: PosProductWrite = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      categoryId: f.categoryId,
      brandId: f.brandId || null,
      basePrice: basePrice as number,
      salePrice,
      mrp: money(f.mrp),
      costPrice: money(f.costPrice),
      vatApplicable: f.vatApplicable,
      posVisible: f.posVisible,
      isActive: f.isActive,
      trackInventory: f.trackInventory,
      lowStockThreshold: Math.max(0, Math.round(Number(f.lowStockThreshold) || 0)),
      attributes,
    };
    // Codes: only send when typed / changed (an empty field on an existing product makes a new code).
    if (!current || f.barcode !== (current.barcode ?? "")) body.barcode = f.barcode.trim() || null;
    if (!current || f.sku.trim() !== (current.sku ?? "")) body.sku = f.sku.trim() || null;
    setBusy(true);
    try {
      if (current) {
        publish(await catalogApi.update(current.id, body));
        toast.success("Product saved");
      } else {
        const created = await catalogApi.create({ ...body, stock: Math.max(0, Math.round(Number(f.stock) || 0)) });
        publish(created);
        setF(fromProduct(created));
        toast.success("Product added. Now add photos and shades.");
        setTab("photos");
      }
    } catch (err) {
      const fields = codeFieldErrors(err);
      if (fields) setErrors(fields);
      else toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const onImages = (images: PosImage[]) => current && publish({ ...current, images, imageUrl: images.find((i) => i.isPrimary)?.url ?? images[0]?.url ?? null });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={current ? "Edit product" : "New product"} className="max-w-3xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{current ? current.name : "New product"}</DialogTitle>
          <DialogDescription>Saved to the shop catalog; the website updates too. Prices include VAT, in whole rupees.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList label="Product sections">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="photos">Photos{current?.images?.length ? ` (${current.images.length})` : ""}</TabsTrigger>
            <TabsTrigger value="shades">Shades{current?.variants.length ? ` (${current.variants.length})` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name *" className="sm:col-span-2" error={errors.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} autoFocus={!current} /></Field>
                <Field label="Category *" error={errors.categoryId}><TaxonomySelect kind="category" value={f.categoryId} onChange={(v) => set("categoryId", v)} required invalid={Boolean(errors.categoryId)} /></Field>
                <Field label="Brand"><TaxonomySelect kind="brand" value={f.brandId} onChange={(v) => set("brandId", v)} /></Field>
                <CodeFields barcode={f.barcode} sku={f.sku} onBarcode={(v) => set("barcode", v)} onSku={(v) => set("sku", v)} errors={errors} existing={Boolean(current)} />
              </div>
              <fieldset className="grid gap-3 sm:grid-cols-4">
                <legend className="mb-2 text-sm font-semibold">Price (Rs)</legend>
                <Field label="Selling price *" error={errors.basePrice}><Input inputMode="numeric" value={f.basePrice} onChange={(e) => set("basePrice", digits(e.target.value))} aria-invalid={Boolean(errors.basePrice)} /></Field>
                <Field label="Sale price" error={errors.salePrice}><Input inputMode="numeric" value={f.salePrice} onChange={(e) => set("salePrice", digits(e.target.value))} placeholder="None" aria-invalid={Boolean(errors.salePrice)} /></Field>
                <Field label="MRP (printed price)"><Input inputMode="numeric" value={f.mrp} onChange={(e) => set("mrp", digits(e.target.value))} /></Field>
                <Field label="Cost (what we pay)"><Input inputMode="numeric" value={f.costPrice} onChange={(e) => set("costPrice", digits(e.target.value))} /></Field>
              </fieldset>
              <fieldset className="grid gap-3 sm:grid-cols-4">
                <legend className="mb-2 text-sm font-semibold">Cosmetics details</legend>
                <Field label="Shade"><Input value={f.shade} onChange={(e) => set("shade", e.target.value)} /></Field>
                <Field label="Batch / lot"><Input value={f.batch} onChange={(e) => set("batch", e.target.value)} /></Field>
                <Field label="Expiry date"><Input type="date" value={f.expiry} onChange={(e) => set("expiry", e.target.value)} /></Field>
                <div className="flex items-end"><CheckField label="Tester" checked={f.tester} onChange={(v) => set("tester", v)} /></div>
              </fieldset>
              <fieldset className="grid gap-3 sm:grid-cols-4">
                <legend className="mb-2 text-sm font-semibold">Stock</legend>
                {current ? (
                  <p className="text-sm sm:col-span-2">
                    In stock: <strong className="tabular">{current.stock}</strong>
                    <span className="block text-xs text-muted-foreground">Change stock in <Link href="/inventory" className="font-medium text-primary underline">Stock</Link> so every change is recorded.</span>
                  </p>
                ) : (
                  <Field label="Opening stock" className="sm:col-span-2"><Input inputMode="numeric" value={f.stock} onChange={(e) => set("stock", digits(e.target.value))} /></Field>
                )}
                <Field label="Warn when stock is at or below"><Input inputMode="numeric" value={f.lowStockThreshold} onChange={(e) => set("lowStockThreshold", digits(e.target.value))} /></Field>
                <div className="flex items-end"><CheckField label="Count stock" checked={f.trackInventory} onChange={(v) => set("trackInventory", v)} /></div>
              </fieldset>
              <div className="grid gap-x-6 sm:grid-cols-3">
                <CheckField label="VAT applies" hint="Turn off for VAT-free items" checked={f.vatApplicable} onChange={(v) => set("vatApplicable", v)} />
                <CheckField label="Sell at the counter" checked={f.posVisible} onChange={(v) => set("posVisible", v)} />
                <CheckField label="Active" hint="Off hides it everywhere" checked={f.isActive} onChange={(v) => set("isActive", v)} />
              </div>
              <Field label="Description"><Textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>{current ? "Close" : "Cancel"}</Button>
                <Button type="submit" variant="brand" disabled={busy}>{busy ? "Saving…" : current ? "Save changes" : "Add product"}</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="photos">
            {current ? <PhotoManager product={current} onImages={onImages} /> : <SaveFirst onDetails={() => setTab("details")} />}
          </TabsContent>
          <TabsContent value="shades">
            {current ? <VariantManager product={current} onProduct={publish} /> : <SaveFirst onDetails={() => setTab("details")} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SaveFirst({ onDetails }: { onDetails: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm">
      <p className="text-muted-foreground">Save the product details first.</p>
      <Button variant="link" onClick={onDetails}>Go to details</Button>
    </div>
  );
}
