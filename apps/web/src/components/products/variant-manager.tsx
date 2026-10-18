"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { catalogApi } from "@/lib/api/catalog";
import type { PosProduct, PosVariant, VariantWrite } from "@/lib/api/types";
import { digitsToInt, formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { CodeFields, codeFieldErrors, type CodeErrors } from "./code-fields";

type Draft = { name: string; price: string; salePrice: string; barcode: string; sku: string; stock: string };

const blank = (product: PosProduct): Draft => ({ name: "", price: String(product.basePrice || product.price || ""), salePrice: "", barcode: "", sku: "", stock: "0" });
const fromVariant = (v: PosVariant): Draft => ({
  name: v.name,
  price: String(v.basePrice ?? v.price),
  salePrice: v.salePrice != null ? String(v.salePrice) : "",
  barcode: v.barcode ?? "",
  sku: v.sku ?? "",
  stock: String(v.stock),
});

/** Shades / sizes of a product, each with its own barcode, SKU, price and stock. */
export function VariantManager({ product, onProduct }: { product: PosProduct; onProduct: (p: PosProduct) => void }) {
  const [editing, setEditing] = useState<PosVariant | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = async (v: PosVariant) => {
    if (!window.confirm(`Delete the shade "${v.name}"? Past sales keep it; it disappears from the POS.`)) return;
    setBusyId(v.id);
    try {
      onProduct((await catalogApi.deleteVariant(product.id, v.id)).product);
      toast.success("Shade deleted");
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {product.variants.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Shades</caption>
            <thead className="text-left text-xs font-medium text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">Shade</th>
                <th scope="col" className="py-2 pr-3">Barcode / SKU</th>
                <th scope="col" className="py-2 pr-3 text-right">Price</th>
                <th scope="col" className="py-2 pr-3 text-right">Stock</th>
                <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{v.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{v.barcode}<span className="block text-muted-foreground">{v.sku}</span></td>
                  <td className="tabular py-2 pr-3 text-right">{formatNPR(v.price)}</td>
                  <td className="tabular py-2 pr-3 text-right">{v.stock}</td>
                  <td className="py-2 text-right">
                    <span className="inline-flex">
                      <Button size="icon" variant="ghost" aria-label={`Edit ${v.name}`} onClick={() => setEditing(v)} disabled={busyId === v.id}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-danger" aria-label={`Delete ${v.name}`} onClick={() => void remove(v)} disabled={busyId === v.id}><Trash2 className="h-4 w-4" /></Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No shades. Add shades (or sizes) when one product comes in several colours, each with its own barcode.</p>
      )}

      {editing ? (
        <VariantForm key={editing === "new" ? "new" : editing.id} product={product} variant={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={(p) => { onProduct(p); setEditing(null); }} />
      ) : (
        <Button variant="outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Add shade</Button>
      )}
    </div>
  );
}

function VariantForm({ product, variant, onCancel, onSaved }: { product: PosProduct; variant: PosVariant | null; onCancel: () => void; onSaved: (p: PosProduct) => void }) {
  const [d, setD] = useState<Draft>(() => (variant ? fromVariant(variant) : blank(product)));
  const [errors, setErrors] = useState<CodeErrors & { name?: string; price?: string }>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    const price = digitsToInt(d.price);
    const salePrice = d.salePrice.trim() ? digitsToInt(d.salePrice) : null;
    const next: typeof errors = {};
    if (!d.name.trim()) next.name = "Enter the shade name.";
    if (price <= 0) next.price = "Enter the price.";
    if (salePrice !== null && salePrice >= price) next.salePrice = "Sale price must be lower than the price.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const body: VariantWrite = { name: d.name.trim(), price, salePrice };
    if (!variant || d.barcode !== (variant.barcode ?? "")) body.barcode = d.barcode || null;
    if (!variant || d.sku.trim() !== (variant.sku ?? "")) body.sku = d.sku.trim() || null;
    setBusy(true);
    try {
      const res = variant
        ? await catalogApi.updateVariant(product.id, variant.id, body)
        : await catalogApi.createVariant(product.id, { ...body, stock: digitsToInt(d.stock) });
      toast.success(variant ? "Shade saved" : "Shade added");
      onSaved(res.product);
    } catch (err) {
      const fields = codeFieldErrors(err);
      if (fields) setErrors(fields);
      else toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-3 rounded-xl border border-border bg-muted/40 p-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="font-semibold">{variant ? `Edit ${variant.name}` : "New shade"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shade / size name *" error={errors.name}><Input value={d.name} onChange={(e) => set("name", e.target.value)} autoFocus aria-invalid={Boolean(errors.name)} placeholder="e.g. 128 Warm Nude" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (Rs) *" error={errors.price}><Input inputMode="numeric" value={d.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(errors.price)} /></Field>
          <Field label="Sale price" error={errors.salePrice}><Input inputMode="numeric" value={d.salePrice} onChange={(e) => set("salePrice", e.target.value.replace(/\D/g, ""))} placeholder="None" aria-invalid={Boolean(errors.salePrice)} /></Field>
        </div>
        <CodeFields barcode={d.barcode} sku={d.sku} onBarcode={(v) => set("barcode", v)} onSku={(v) => set("sku", v)} errors={errors} existing={Boolean(variant)} />
        {variant ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">Stock: <strong>{variant.stock}</strong>. To change it use <Link href="/inventory" className="font-medium text-primary underline">Stock</Link> (keeps a record of every change).</p>
        ) : (
          <Field label="Opening stock"><Input inputMode="numeric" value={d.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} /></Field>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : variant ? "Save shade" : "Add shade"}</Button>
      </div>
    </form>
  );
}
