"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalogApi } from "@/lib/api/catalog";
import type { Brand, Category, PosProduct, PosProductWrite } from "@/lib/api/types";
import { toastError } from "@/lib/notify";
import { upsertCachedProduct } from "@/lib/offline/catalog-cache";

type Form = {
  name: string; sku: string; barcode: string; description: string; categoryId: string; brandId: string;
  basePrice: string; salePrice: string; mrp: string; costPrice: string; stock: string; lowStockThreshold: string;
  vatApplicable: boolean; posVisible: boolean; isActive: boolean; trackInventory: boolean;
  shade: string; batch: string; expiry: string; tester: boolean; image: string;
};

const empty: Form = {
  name: "", sku: "", barcode: "", description: "", categoryId: "", brandId: "", basePrice: "", salePrice: "", mrp: "", costPrice: "", stock: "0",
  lowStockThreshold: "5", vatApplicable: true, posVisible: true, isActive: true, trackInventory: true, shade: "", batch: "", expiry: "", tester: false, image: "",
};

function fromProduct(p: PosProduct): Form {
  return {
    name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", description: p.description ?? "", categoryId: p.categoryId ?? "", brandId: p.brandId ?? "",
    basePrice: String(p.basePrice ?? ""), salePrice: p.salePrice != null ? String(p.salePrice) : "", mrp: p.mrp != null ? String(p.mrp) : "",
    costPrice: p.costPrice != null ? String(p.costPrice) : "", stock: String(p.stock), lowStockThreshold: String(p.lowStockThreshold),
    vatApplicable: p.vatApplicable, posVisible: p.posVisible, isActive: p.isActive, trackInventory: p.trackInventory ?? true,
    shade: p.attributes?.shade ?? "", batch: p.attributes?.batch ?? "", expiry: p.attributes?.expiry ?? "", tester: Boolean(p.attributes?.tester), image: p.imageUrl ?? "",
  };
}

const money = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

export function ProductDialog({ open, onOpenChange, product, categories, brands, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; product: PosProduct | null; categories: Category[]; brands: Brand[]; onSaved: (p: PosProduct) => void;
}) {
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF(product ? fromProduct(product) : empty); }, [open, product]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    const basePrice = money(f.basePrice);
    if (!f.name.trim() || !f.categoryId || !basePrice || basePrice <= 0) {
      toast.error("Name, category and a selling price are required.");
      return;
    }
    const attributes = { shade: f.shade.trim() || undefined, batch: f.batch.trim() || undefined, expiry: f.expiry || undefined, tester: f.tester || undefined };
    const body: PosProductWrite = {
      name: f.name.trim(),
      sku: f.sku.trim() || null,
      barcode: f.barcode.trim() || null,
      description: f.description.trim() || null,
      categoryId: f.categoryId,
      brandId: f.brandId || null,
      basePrice,
      salePrice: money(f.salePrice),
      mrp: money(f.mrp),
      costPrice: money(f.costPrice),
      vatApplicable: f.vatApplicable,
      posVisible: f.posVisible,
      isActive: f.isActive,
      trackInventory: f.trackInventory,
      lowStockThreshold: Math.max(0, Math.round(Number(f.lowStockThreshold) || 0)),
      attributes,
      ...(f.image.trim() ? { images: [f.image.trim()] } : {}),
    };
    setBusy(true);
    try {
      const saved = product ? await catalogApi.update(product.id, body) : await catalogApi.create({ ...body, stock: Math.max(0, Math.round(Number(f.stock) || 0)) });
      await upsertCachedProduct(saved).catch(() => undefined);
      toast.success(product ? "Product updated" : "Product created");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={product ? "Edit product" : "New product"} className="max-w-3xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "New product"}</DialogTitle>
          <DialogDescription>Saved to the live catalog — the storefront updates too. Prices are VAT-inclusive whole rupees.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} required /></Field>
            <Field label="Category *">
              <Select value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
                <option value="">Choose…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Brand">
              <Select value={f.brandId} onChange={(e) => set("brandId", e.target.value)}>
                <option value="">None</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="SKU"><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
            <Field label="Barcode (EAN / UPC / Code128)"><Input value={f.barcode} onChange={(e) => set("barcode", e.target.value)} inputMode="numeric" /></Field>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-4">
            <legend className="mb-2 text-sm font-semibold">Pricing (Rs)</legend>
            <Field label="Selling price *"><Input inputMode="numeric" value={f.basePrice} onChange={(e) => set("basePrice", e.target.value.replace(/\D/g, ""))} required /></Field>
            <Field label="Sale price"><Input inputMode="numeric" value={f.salePrice} onChange={(e) => set("salePrice", e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="MRP"><Input inputMode="numeric" value={f.mrp} onChange={(e) => set("mrp", e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Cost"><Input inputMode="numeric" value={f.costPrice} onChange={(e) => set("costPrice", e.target.value.replace(/\D/g, ""))} /></Field>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-4">
            <legend className="mb-2 text-sm font-semibold">Cosmetics details</legend>
            <Field label="Shade"><Input value={f.shade} onChange={(e) => set("shade", e.target.value)} /></Field>
            <Field label="Batch / lot"><Input value={f.batch} onChange={(e) => set("batch", e.target.value)} /></Field>
            <Field label="Expiry"><Input type="date" value={f.expiry} onChange={(e) => set("expiry", e.target.value)} /></Field>
            <div className="flex items-end"><CheckField label="Tester" checked={f.tester} onChange={(v) => set("tester", v)} /></div>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-4">
            <legend className="mb-2 text-sm font-semibold">Stock</legend>
            <Field label={product ? "Stock (use Inventory to adjust)" : "Opening stock"}><Input inputMode="numeric" value={f.stock} disabled={Boolean(product)} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Reorder at (low stock)"><Input inputMode="numeric" value={f.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value.replace(/\D/g, ""))} /></Field>
            <div className="sm:col-span-2"><CheckField label="Track inventory" checked={f.trackInventory} onChange={(v) => set("trackInventory", v)} /></div>
          </fieldset>
          <div className="grid gap-x-6 sm:grid-cols-3">
            <CheckField label="VAT applicable" hint="Off for VAT-exempt items" checked={f.vatApplicable} onChange={(v) => set("vatApplicable", v)} />
            <CheckField label="Sell at POS" checked={f.posVisible} onChange={(v) => set("posVisible", v)} />
            <CheckField label="Active" checked={f.isActive} onChange={(v) => set("isActive", v)} />
          </div>
          <Field label="Image URL"><Input type="url" value={f.image} onChange={(e) => set("image", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Description"><Textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
          {product && product.variants.length > 0 && (
            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="mb-2 font-medium">Shades / variants</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {product.variants.map((v) => <li key={v.id}>{v.name} · {v.sku ?? v.barcode ?? "—"} · Rs {v.price} · {v.stock} pcs</li>)}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Variants are managed in the GLAMO website admin.</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save product"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
