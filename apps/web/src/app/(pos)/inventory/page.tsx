"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Barcode, Check, PackagePlus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ProductImage } from "@/components/product-image";
import { LabelPrintPanel } from "@/components/products/label-print-panel";
import { PrintLabelDialog } from "@/components/products/print-label-dialog";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import { StockBadge } from "@/components/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { catalogApi } from "@/lib/api/catalog";
import { inventoryApi } from "@/lib/api/inventory";
import type { InventoryReason, PosProduct, SyncConflict } from "@/lib/api/types";
import { formatDateTime, formatNPR } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";
import { toastError } from "@/lib/notify";
import { upsertCachedProduct } from "@/lib/offline/catalog-cache";
import { db, type PendingSale, type StoredSyncResult } from "@/lib/offline/db";
import { acknowledgeResult, retryNow } from "@/lib/offline/queue";
import { refreshCounts, runSyncCycle } from "@/lib/offline/sync-runner";
import { useApi } from "@/lib/use-api";

const TABS = ["stock", "barcodes", "movements", "reconcile"] as const;

export default function InventoryPage() {
  const [tab, setTab] = useState<string>("stock");
  const [movementProduct, setMovementProduct] = useState<PosProduct | null>(null);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && (TABS as readonly string[]).includes(t)) setTab(t);
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Stock" description="Receive new stock, correct counts, print barcode labels and see every stock change." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList label="Stock sections">
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="barcodes"><Barcode className="h-4 w-4" aria-hidden /> Barcode labels</TabsTrigger>
          <TabsTrigger value="movements">History</TabsTrigger>
          <TabsTrigger value="reconcile">Offline sales check</TabsTrigger>
        </TabsList>
        <TabsContent value="stock"><StockTab onMovements={(p) => { setMovementProduct(p); setTab("movements"); }} /></TabsContent>
        <TabsContent value="barcodes"><LabelPrintPanel /></TabsContent>
        <TabsContent value="movements"><MovementsTab product={movementProduct} onClear={() => setMovementProduct(null)} /></TabsContent>
        <TabsContent value="reconcile"><ReconcileTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function StockTab({ onMovements }: { onMovements: (p: PosProduct) => void }) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 300);
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [adjust, setAdjust] = useState<{ product: PosProduct; reason: InventoryReason } | null>(null);
  const [labelFor, setLabelFor] = useState<PosProduct | null>(null);
  useEffect(() => setPage(1), [query]);
  const { data, error, loading, reload } = useApi(() => catalogApi.list({ q: query, lowStock: lowStock ? "true" : undefined, page, limit: 25 }), [query, lowStock, page]);
  return (
    <Card>
      <CardContent className="space-y-3 p-2 sm:p-4">
        <div className="flex flex-wrap items-end gap-3 p-2 sm:p-0">
          <SearchInput className="min-w-0 basis-full sm:min-w-[240px] sm:flex-1" value={q} onChange={setQ} label="Search stock" placeholder="Name, barcode or SKU" />
          <CheckField label="Running low only" checked={lowStock} onChange={(v) => { setLowStock(v); setPage(1); }} />
        </div>
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
          <div className="overflow-x-auto">
            <table className="mobile-record-table w-full text-sm">
              <caption className="sr-only">Stock levels</caption>
              <thead className="text-left text-xs font-medium text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pl-2 pr-3">Product</th>
                  <th scope="col" className="py-2 pr-3 text-right">In stock</th>
                  <th scope="col" className="hidden py-2 pr-3 text-right sm:table-cell">Warn at</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pl-2 pr-3">
                      <div className="flex items-center gap-3">
                        <ProductImage src={p.imageUrl} name={p.name} className="h-11 w-11 shrink-0 border border-border" />
                        <div className="min-w-0">
                          <span className="block font-semibold">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.variants.length ? p.variants.map((v) => `${v.name}: ${v.stock}`).join(" · ") : (p.barcode ?? p.sku ?? "")}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="In stock" className="tabular py-2 pr-3 text-right text-base font-bold">{p.stock}</td>
                    <td data-label="Warn at" className="tabular hidden py-2 pr-3 text-right sm:table-cell">{p.lowStockThreshold}</td>
                    <td data-label="Status" className="py-2 pr-3"><StockBadge stock={p.stock} threshold={p.lowStockThreshold} track={p.trackInventory ?? true} /></td>
                    <td className="py-2 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        <Button size="sm" onClick={() => setAdjust({ product: p, reason: "RECEIVE" })}><PackagePlus className="h-4 w-4" aria-hidden /> Receive</Button>
                        <Button size="sm" variant="outline" onClick={() => setAdjust({ product: p, reason: "COUNT" })}><SlidersHorizontal className="h-4 w-4" aria-hidden /> Correct</Button>
                        <Button size="sm" variant="ghost" onClick={() => setLabelFor(p)} aria-label={`Print labels for ${p.name}`}><Barcode className="h-4 w-4" aria-hidden /> Label</Button>
                        <Button size="sm" variant="ghost" onClick={() => onMovements(p)}>History</Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">{query || lowStock ? "No products match." : "No products yet."}</p>}
          </div>
        )}
        {data && !data.items.length && (q || lowStock) && <Button variant="outline" onClick={() => { setQ(""); setLowStock(false); setPage(1); }}>Clear filters</Button>}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </CardContent>
      <AdjustDialog target={adjust} onClose={() => setAdjust(null)} onDone={() => void reload()} />
      <PrintLabelDialog product={labelFor} onClose={() => setLabelFor(null)} />
    </Card>
  );
}

const REASONS: Array<{ value: InventoryReason; label: string; sign: 1 | -1 | 0 }> = [
  { value: "RECEIVE", label: "New stock arrived", sign: 1 },
  { value: "COUNT", label: "I counted the shelf (set the real number)", sign: 0 },
  { value: "RETURN", label: "Customer returned it to the shelf", sign: 1 },
  { value: "DAMAGE", label: "Damaged or expired (remove)", sign: -1 },
  { value: "ADJUST", label: "Other change (add or remove)", sign: 0 },
];

function AdjustDialog({ target, onClose, onDone }: { target: { product: PosProduct; reason: InventoryReason } | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<InventoryReason>("RECEIVE");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [negative, setNegative] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  /** Latest stock from the server (the list may be a few sales old). */
  const [fresh, setFresh] = useState<PosProduct | null>(null);
  useEffect(() => {
    if (!target) return;
    setReason(target.reason);
    setVariantId(target.product.variants[0]?.id ?? "");
    setQty("");
    setNegative(false);
    setNote("");
    setFresh(null);
    let alive = true;
    catalogApi.get(target.product.id).then((p) => alive && setFresh(p)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [target]);
  if (!target) return null;
  const p = fresh ?? target.product;
  const current = variantId ? p.variants.find((v) => v.id === variantId)?.stock ?? 0 : p.stock;
  const n = Math.round(Number(qty) || 0);
  const sign = REASONS.find((r) => r.value === reason)?.sign ?? 0;
  const delta = reason === "COUNT" ? n - current : sign === 0 ? (negative ? -n : n) : sign * n;
  const submit = async () => {
    if (!qty.trim()) return void toast.error(reason === "COUNT" ? "Enter how many are on the shelf." : "Enter how many.");
    if (delta === 0) return void toast.error(reason === "COUNT" ? "That is already the stock number. Nothing to change." : "Enter how many.");
    setBusy(true);
    try {
      const res = await inventoryApi.adjust({ productId: p.id, variantId: variantId || undefined, delta, reason, note: note.trim() || undefined });
      toast.success(`${p.name}: ${res.stock} in stock now`);
      catalogApi.get(p.id).then(upsertCachedProduct).catch(() => undefined);
      onDone();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} label="Adjust stock">
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>{p.name}</DialogTitle>
          <DialogDescription>In stock now: {current}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="What happened?">
            <Select value={reason} onChange={(e) => setReason(e.target.value as InventoryReason)}>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          {p.variants.length > 0 && (
            <Field label="Shade">
              <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                {p.variants.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.stock})</option>)}
              </Select>
            </Field>
          )}
          <Field label={reason === "COUNT" ? "How many are on the shelf?" : "How many?"} hint={qty ? `${current} → ${current + delta} (${delta > 0 ? "+" : ""}${delta})` : undefined}>
            <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} autoFocus />
          </Field>
          {reason === "ADJUST" && <CheckField label="Remove from stock" checked={negative} onChange={setNegative} />}
          <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier bill number, batch, reason…" /></Field>
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const MOVEMENT_LABEL: Record<string, string> = { RECEIVE: "Received", ADJUST: "Changed", DAMAGE: "Damaged", RETURN: "Returned", COUNT: "Counted", SALE: "Sold", REFUND: "Refunded", CANCEL: "Cancelled" };

function MovementsTab({ product, onClear }: { product: PosProduct | null; onClear: () => void }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [product?.id]);
  const { data, error, loading, reload } = useApi(() => inventoryApi.movements({ productId: product?.id, page, limit: 30 }), [product?.id, page]);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {product && <p className="text-sm">Showing <strong>{product.name}</strong> · <button type="button" className="min-h-11 text-primary underline" onClick={onClear}>show all products</button></p>}
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Stock movements</caption>
              <thead className="text-left text-xs font-medium text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3">When</th><th scope="col" className="py-2 pr-3">Product</th><th scope="col" className="py-2 pr-3">What</th>
                  <th scope="col" className="py-2 pr-3 text-right">Change</th><th scope="col" className="py-2 pr-3 text-right">Stock</th><th scope="col" className="py-2 pr-3">By</th><th scope="col" className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-xs">{m.createdAt && formatDateTime(m.createdAt)}</td>
                    <td className="py-2 pr-3">{m.productName}{m.variantName && <span className="text-muted-foreground"> — {m.variantName}</span>}</td>
                    <td className="py-2 pr-3 text-xs">{MOVEMENT_LABEL[m.type] ?? m.type.replace(/_/g, " ").toLowerCase()}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                    <td className="py-2 pr-3 text-right">{m.previousStock} → {m.newStock}</td>
                    <td className="py-2 pr-3 text-xs">{m.performedByName ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">No stock changes yet.</p>}
          </div>
        )}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </CardContent>
    </Card>
  );
}

/** Server conflicts (sales recorded with stock below zero) + this device's sync problems. Nothing is dropped silently. */
function ReconcileTab() {
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<SyncConflict | null>(null);
  const [local, setLocal] = useState<{ rejected: PendingSale[]; conflicts: StoredSyncResult[] }>({ rejected: [], conflicts: [] });
  const { data, error, loading, reload } = useApi(() => inventoryApi.conflicts(status, page), [status, page]);

  const loadLocal = useCallback(async () => {
    const pending = await db().pendingSales.toArray();
    const conflicts = (await db().syncResults.where("status").equals("conflict").toArray()).filter((r) => !r.acknowledged);
    setLocal({ rejected: pending.filter((p) => p.needsAttention || p.status === "error"), conflicts });
    await refreshCounts();
  }, []);
  useEffect(() => { void loadLocal(); }, [loadLocal]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">This device</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!local.rejected.length && !local.conflicts.length && <p className="text-sm text-muted-foreground">All offline sales from this device were sent. Nothing to check.</p>}
          {local.rejected.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Offline sales the server did not accept yet (kept on this device and retried)</p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {local.rejected.map((s) => (
                  <li key={s.clientRef} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="font-mono">{s.provisionalRef}</span>
                    <span>{formatNPR(s.total)}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(new Date(s.createdAt))} · tried {s.attempts} {s.attempts === 1 ? "time" : "times"}</span>
                    <span className="flex-1 text-danger">{s.lastError}</span>
                    <Button size="sm" variant="outline" onClick={async () => { await retryNow(s.clientRef); await runSyncCycle(); await loadLocal(); }}>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again now
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {local.conflicts.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Sent, but more was sold than the stock we had (sale is saved; please count the shelf)</p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {local.conflicts.map((r) => (
                  <li key={r.clientRef} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="font-mono">{r.provisionalRef} → {r.printableRef ?? r.orderId}</span>
                    <span className="flex-1 text-xs text-muted-foreground">{r.conflicts?.map((c) => `sold ${c.requested}, had ${c.available}`).join("; ")}</span>
                    <Button size="sm" variant="ghost" onClick={async () => { await acknowledgeResult(r.clientRef); await loadLocal(); }}><Check className="h-3.5 w-3.5" aria-hidden /> Seen</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Stock problems from offline sales (all counters)</CardTitle>
          <Select aria-label="Show" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} className="w-40">
            <option value="open">To sort out</option><option value="resolved">Sorted</option><option value="all">All</option>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
            <ul className="divide-y divide-border">
              {(data?.items ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <StatusBadge status={c.status} />
                  <span className="font-mono text-xs">{c.printableRef ?? c.clientRef}</span>
                  <span className="font-medium">{c.productName}{c.variantName ? ` — ${c.variantName}` : ""}</span>
                  <span className="text-xs text-muted-foreground">sold {c.requested}, we had {c.available} · {c.createdAt && formatDateTime(c.createdAt)}</span>
                  {c.note && <span className="text-xs text-muted-foreground">“{c.note}”</span>}
                  {c.status === "open" && <Button size="sm" className="ml-auto" onClick={() => setResolving(c)}>Mark sorted</Button>}
                </li>
              ))}
              {!data?.items.length && <li className="py-6 text-center text-sm text-muted-foreground">Nothing to sort out.</li>}
            </ul>
          )}
          {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
        </CardContent>
      </Card>
      <ResolveDialog conflict={resolving} onClose={() => setResolving(null)} onDone={() => void reload()} />
    </div>
  );
}

function ResolveDialog({ conflict, onClose, onDone }: { conflict: SyncConflict | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setNote(""), [conflict]);
  if (!conflict) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await inventoryApi.resolveConflict(conflict.id, note.trim());
      toast.success("Marked as sorted");
      onDone();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} label="Resolve conflict">
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Sort out stock problem</DialogTitle>
          <DialogDescription>{conflict.productName}: {conflict.requested} sold offline while only {conflict.available} were in stock. Count the shelf, correct the stock in the Stock tab if needed, then write what you did.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="What did you do? (required)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Counted 4 on the shelf, corrected stock" /></Field>
          <Button type="submit" variant="brand" className="w-full" disabled={busy || !note.trim()}>{busy ? "Saving…" : "Mark sorted"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
