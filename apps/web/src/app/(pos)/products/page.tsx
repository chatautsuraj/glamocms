"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Barcode, Pencil, Plus, Trash2 } from "lucide-react";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ProductDialog } from "@/components/product-dialog";
import { ProductImage } from "@/components/product-image";
import { PrintLabelDialog } from "@/components/products/print-label-dialog";
import { TaxonomyManager } from "@/components/products/taxonomy-manager";
import { SearchInput } from "@/components/search-input";
import { StockBadge } from "@/components/stock-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckField } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catalogApi } from "@/lib/api/catalog";
import type { PosProduct } from "@/lib/api/types";
import { useTaxonomy } from "@/lib/catalog-taxonomy";
import { formatNPR } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { db } from "@/lib/offline/db";
import { expiryState } from "@/lib/pos/sellable";
import { useApi } from "@/lib/use-api";
import { useDebounced } from "@/lib/use-debounced";

export default function ProductsPage() {
  const [tab, setTab] = useState("products");
  return (
    <div className="space-y-4">
      <PageHeader title="Products" description="Add and edit products, photos, shades, prices and barcodes. Changes show at the counter and on the website." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList label="Products sections">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="taxonomy">Categories &amp; brands</TabsTrigger>
        </TabsList>
        <TabsContent value="products"><ProductList /></TabsContent>
        <TabsContent value="taxonomy"><TaxonomyManager /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProductList() {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 300);
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const categories = useTaxonomy((s) => s.categories);
  const brands = useTaxonomy((s) => s.brands);
  const [editing, setEditing] = useState<PosProduct | null>(null);
  const [open, setOpen] = useState(false);
  const [labelFor, setLabelFor] = useState<PosProduct | null>(null);

  useEffect(() => {
    void useTaxonomy.getState().load();
  }, []);
  useEffect(() => setPage(1), [query]);

  const { data, error, loading, reload } = useApi(
    () => catalogApi.list({ q: query, category, brand, lowStock: lowStock ? "true" : undefined, page, limit: 25 }),
    [query, category, brand, lowStock, page],
  );

  const remove = async (p: PosProduct) => {
    if (!window.confirm(`Delete ${p.name}? It disappears from the counter and the website. Past sales are kept.`)) return;
    try {
      await catalogApi.remove(p.id);
      await db().products.delete(p.id).catch(() => undefined);
      toast.success("Product deleted");
      void reload();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <SearchInput className="min-w-0 basis-full sm:min-w-[240px] sm:flex-1" value={q} onChange={setQ} label="Search products" placeholder="Name, SKU or barcode" />
          <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-48">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select aria-label="Brand" value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} className="w-48">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <CheckField label="Running low only" checked={lowStock} onChange={(v) => { setLowStock(v); setPage(1); }} />
          <Button variant="brand" className="ml-auto" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" aria-hidden /> New product</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-2 sm:p-4">
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows rows={8} /> : (
            <div className="overflow-x-auto">
              <table className="mobile-record-table w-full text-sm">
                <caption className="sr-only">Products</caption>
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pl-2 pr-3">Product</th>
                    <th scope="col" className="hidden py-2 pr-3 md:table-cell">Barcode / SKU</th>
                    <th scope="col" className="py-2 pr-3 text-right">Price</th>
                    <th scope="col" className="hidden py-2 pr-3 text-right lg:table-cell">Cost</th>
                    <th scope="col" className="py-2 pr-3">Stock</th>
                    <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((p) => {
                    const exp = expiryState(p.attributes?.expiry);
                    return (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="py-2 pl-2 pr-3">
                          <div className="flex items-center gap-3">
                            <ProductImage src={p.imageUrl} name={p.name} className="h-12 w-12 shrink-0 border border-border" />
                            <div className="min-w-0">
                              <button type="button" className="block min-h-11 break-words text-left font-semibold hover:underline" onClick={() => { setEditing(p); setOpen(true); }}>{p.name}</button>
                              <span className="block text-xs text-muted-foreground">{[p.brand, p.category].filter(Boolean).join(" · ")}</span>
                              <span className="mt-0.5 flex flex-wrap gap-1">
                                {p.variants.length > 0 && <Badge variant="secondary">{p.variants.length} shades</Badge>}
                                {!p.isActive && <Badge variant="danger">Hidden</Badge>}
                                {p.isActive && !p.posVisible && <Badge variant="muted">Not at counter</Badge>}
                                {!p.vatApplicable && <Badge variant="muted">No VAT</Badge>}
                                {p.attributes?.tester && <Badge variant="warning">Tester</Badge>}
                                {exp === "expired" && <Badge variant="danger">Expired</Badge>}
                                {exp === "soon" && <Badge variant="warning">Expires {p.attributes.expiry}</Badge>}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Barcode / SKU" className="hidden py-2 pr-3 font-mono text-xs md:table-cell">{p.barcode ?? "—"}<span className="block text-muted-foreground">{p.sku}</span></td>
                        <td data-label="Price" className="tabular py-2 pr-3 text-right font-semibold">
                          {formatNPR(p.price)}
                          {p.salePrice != null && p.price < p.basePrice && <span className="block text-xs font-normal text-muted-foreground line-through">{formatNPR(p.basePrice)}</span>}
                        </td>
                        <td className="tabular hidden py-2 pr-3 text-right lg:table-cell">{p.costPrice != null ? formatNPR(p.costPrice) : "—"}</td>
                        <td data-label="Stock" className="py-2 pr-3"><StockBadge stock={p.stock} threshold={p.lowStockThreshold} track={p.trackInventory ?? true} /></td>
                        <td className="py-2 text-right">
                          <span className="inline-flex">
                            <Button variant="ghost" size="icon" aria-label={`Print labels for ${p.name}`} title="Print label" onClick={() => setLabelFor(p)}><Barcode className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-danger" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => void remove(p)}><Trash2 className="h-4 w-4" /></Button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data?.items.length && (
                <p className="py-10 text-center text-sm text-muted-foreground">{query || category || brand || lowStock ? "No products match these filters." : "No products yet. Add your first product."}</p>
              )}
            </div>
          )}
          {data && !data.items.length && (q || category || brand || lowStock) && <Button variant="outline" onClick={() => { setQ(""); setCategory(""); setBrand(""); setLowStock(false); setPage(1); }}>Clear filters</Button>}
          {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
        </CardContent>
      </Card>
      <ProductDialog open={open} onOpenChange={setOpen} product={editing} onSaved={() => void reload()} />
      <PrintLabelDialog product={labelFor} onClose={() => setLabelFor(null)} />
    </div>
  );
}
