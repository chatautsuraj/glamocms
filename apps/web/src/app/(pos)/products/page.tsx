"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Barcode, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ProductDialog } from "@/components/product-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { catalogApi } from "@/lib/api/catalog";
import type { Brand, Category, PosProduct } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { db } from "@/lib/offline/db";
import { printStockBarcodes } from "@/lib/print-barcodes";
import { expiryState } from "@/lib/pos/sellable";
import { useApi } from "@/lib/use-api";

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editing, setEditing] = useState<PosProduct | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => undefined);
    catalogApi.brands().then(setBrands).catch(() => undefined);
  }, []);

  const { data, error, loading, reload } = useApi(
    () => catalogApi.list({ q: query, category, brand, lowStock: lowStock ? "true" : undefined, page, limit: 25 }),
    [query, category, brand, lowStock, page],
  );

  const remove = async (p: PosProduct) => {
    if (!window.confirm(`Remove ${p.name} from the catalog? It disappears from the till and the website.`)) return;
    try {
      await catalogApi.remove(p.id);
      await db().products.delete(p.id).catch(() => undefined);
      toast.success("Product removed");
      void reload();
    } catch (err) {
      toastError(err);
    }
  };

  const labels = (p: PosProduct) => {
    const code = p.barcode || p.sku;
    if (!code) return void toast.error("Add a barcode or SKU first.");
    const copies = Number(window.prompt(`How many labels for ${p.name}?`, "1") || 0);
    if (copies > 0) printStockBarcodes([{ sku: code, name: p.name, price: p.price, copies }]);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Live GLAMO catalog — shade, batch, tester, expiry, VAT, barcode, MRP, cost and reorder level."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> New product</Button>}
      />
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form className="relative min-w-[240px] flex-1" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}>
            <label>
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU, barcode, brand… (Enter)" />
            </label>
          </form>
          <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-44">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.slug ?? c.id}>{c.name}</option>)}
          </Select>
          <Select aria-label="Brand" value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} className="w-44">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.slug ?? b.id}>{b.name}</option>)}
          </Select>
          <CheckField label="Low stock only" checked={lowStock} onChange={(v) => { setLowStock(v); setPage(1); }} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Products</caption>
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3">Product</th>
                    <th scope="col" className="py-2 pr-3">SKU / barcode</th>
                    <th scope="col" className="py-2 pr-3 text-right">Price</th>
                    <th scope="col" className="py-2 pr-3 text-right">MRP</th>
                    <th scope="col" className="py-2 pr-3 text-right">Cost</th>
                    <th scope="col" className="py-2 pr-3 text-right">Stock</th>
                    <th scope="col" className="py-2 pr-3">Flags</th>
                    <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((p) => {
                    const exp = expiryState(p.attributes?.expiry);
                    const stockState = p.stock <= 0 ? "out" : p.stock <= p.lowStockThreshold ? "low" : "ok";
                    return (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="py-2 pr-3">
                          <span className="block font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{[p.brand, p.category, p.attributes?.shade && `Shade ${p.attributes.shade}`, p.attributes?.batch && `Batch ${p.attributes.batch}`].filter(Boolean).join(" · ")}</span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{p.sku ?? "—"}<br />{p.barcode ?? ""}</td>
                        <td className="py-2 pr-3 text-right">{formatNPR(p.price)}{p.salePrice != null && <span className="block text-xs text-muted-foreground line-through">{formatNPR(p.basePrice)}</span>}</td>
                        <td className="py-2 pr-3 text-right">{p.mrp != null ? formatNPR(p.mrp) : "—"}</td>
                        <td className="py-2 pr-3 text-right">{p.costPrice != null ? formatNPR(p.costPrice) : "—"}</td>
                        <td className="py-2 pr-3 text-right">{p.stock} <StatusBadge status={stockState} className="ml-1" /><span className="block text-xs text-muted-foreground">reorder ≤ {p.lowStockThreshold}</span></td>
                        <td className="py-2 pr-3">
                          <span className="flex flex-wrap gap-1">
                            {!p.vatApplicable && <Badge variant="muted">No VAT</Badge>}
                            {!p.posVisible && <Badge variant="muted">Hidden at POS</Badge>}
                            {!p.isActive && <Badge variant="danger">Inactive</Badge>}
                            {p.attributes?.tester && <Badge variant="warning">Tester</Badge>}
                            {exp === "expired" && <Badge variant="danger">Expired {p.attributes.expiry}</Badge>}
                            {exp === "soon" && <Badge variant="warning">Exp. {p.attributes.expiry}</Badge>}
                            {p.variants.length > 0 && <Badge variant="secondary">{p.variants.length} shades</Badge>}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <span className="inline-flex gap-1">
                            <Button variant="ghost" size="icon" aria-label={`Print labels for ${p.name}`} onClick={() => labels(p)}><Barcode className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-danger" aria-label={`Remove ${p.name}`} onClick={() => void remove(p)}><Trash2 className="h-4 w-4" /></Button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>}
            </div>
          )}
          {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
        </CardContent>
      </Card>
      <ProductDialog open={open} onOpenChange={setOpen} product={editing} categories={categories} brands={brands} onSaved={() => void reload()} />
    </div>
  );
}
