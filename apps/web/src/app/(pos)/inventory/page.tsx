"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, PackagePlus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/status-badge";
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
import { toastError } from "@/lib/notify";
import { upsertCachedProduct } from "@/lib/offline/catalog-cache";
import { db, type PendingSale, type StoredSyncResult } from "@/lib/offline/db";
import { acknowledgeResult, retryNow } from "@/lib/offline/queue";
import { refreshCounts, runSyncCycle } from "@/lib/offline/sync-runner";
import { useApi } from "@/lib/use-api";

export default function InventoryPage() {
  const [tab, setTab] = useState("stock");
  const [movementProduct, setMovementProduct] = useState<PosProduct | null>(null);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t) setTab(t);
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" description="Receive and adjust stock, review movements, reconcile offline-sync conflicts." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="reconcile">Sync reconciliation</TabsTrigger>
        </TabsList>
        <TabsContent value="stock"><StockTab onMovements={(p) => { setMovementProduct(p); setTab("movements"); }} /></TabsContent>
        <TabsContent value="movements"><MovementsTab product={movementProduct} onClear={() => setMovementProduct(null)} /></TabsContent>
        <TabsContent value="reconcile"><ReconcileTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function StockTab({ onMovements }: { onMovements: (p: PosProduct) => void }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [adjust, setAdjust] = useState<{ product: PosProduct; reason: InventoryReason } | null>(null);
  const { data, error, loading, reload } = useApi(() => catalogApi.list({ q: query, lowStock: lowStock ? "true" : undefined, page, limit: 25 }), [query, lowStock, page]);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <form className="relative min-w-[240px] flex-1" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}>
            <label>
              <span className="sr-only">Search stock</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU or barcode (Enter)" />
            </label>
          </form>
          <CheckField label="Low stock only" checked={lowStock} onChange={(v) => { setLowStock(v); setPage(1); }} />
        </div>
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Stock levels</caption>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3">Product</th>
                  <th scope="col" className="py-2 pr-3 text-right">On hand</th>
                  <th scope="col" className="py-2 pr-3 text-right">Reorder at</th>
                  <th scope="col" className="py-2 pr-3">State</th>
                  <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.sku ?? p.barcode ?? ""}{p.variants.length ? ` · ${p.variants.map((v) => `${v.name}: ${v.stock}`).join(", ")}` : ""}</span>
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{p.stock}</td>
                    <td className="py-2 pr-3 text-right">{p.lowStockThreshold}</td>
                    <td className="py-2 pr-3"><StatusBadge status={p.stock <= 0 ? "out" : p.stock <= p.lowStockThreshold ? "low" : "ok"} /></td>
                    <td className="py-2 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        <Button size="sm" onClick={() => setAdjust({ product: p, reason: "RECEIVE" })}><PackagePlus className="h-3.5 w-3.5" /> Receive</Button>
                        <Button size="sm" variant="outline" onClick={() => setAdjust({ product: p, reason: "ADJUST" })}><SlidersHorizontal className="h-3.5 w-3.5" /> Adjust</Button>
                        <Button size="sm" variant="ghost" onClick={() => onMovements(p)}>History</Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
          </div>
        )}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </CardContent>
      <AdjustDialog target={adjust} onClose={() => setAdjust(null)} onDone={() => void reload()} />
    </Card>
  );
}

const REASONS: Array<{ value: InventoryReason; label: string; sign: 1 | -1 | 0 }> = [
  { value: "RECEIVE", label: "Receive stock (purchase / delivery in)", sign: 1 },
  { value: "RETURN", label: "Customer return to shelf", sign: 1 },
  { value: "DAMAGE", label: "Damaged / expired write-off", sign: -1 },
  { value: "ADJUST", label: "Manual adjustment (+/−)", sign: 0 },
  { value: "COUNT", label: "Stock count (set counted quantity)", sign: 0 },
];

function AdjustDialog({ target, onClose, onDone }: { target: { product: PosProduct; reason: InventoryReason } | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<InventoryReason>("RECEIVE");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [negative, setNegative] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!target) return;
    setReason(target.reason);
    setVariantId(target.product.variants[0]?.id ?? "");
    setQty("");
    setNegative(false);
    setNote("");
  }, [target]);
  if (!target) return null;
  const p = target.product;
  const current = variantId ? p.variants.find((v) => v.id === variantId)?.stock ?? 0 : p.stock;
  const n = Math.round(Number(qty) || 0);
  const sign = REASONS.find((r) => r.value === reason)?.sign ?? 0;
  const delta = reason === "COUNT" ? n - current : sign === 0 ? (negative ? -n : n) : sign * n;
  const submit = async () => {
    if (delta === 0) return void toast.error(reason === "COUNT" ? "Counted quantity matches the system — nothing to change." : "Enter a quantity.");
    setBusy(true);
    try {
      const res = await inventoryApi.adjust({ productId: p.id, variantId: variantId || undefined, delta, reason, note: note.trim() || undefined });
      toast.success(`${p.name}: stock now ${res.stock}`);
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
          <DialogDescription>On hand: {current}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value as InventoryReason)}>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          {p.variants.length > 0 && (
            <Field label="Shade / variant">
              <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                {p.variants.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.stock})</option>)}
              </Select>
            </Field>
          )}
          <Field label={reason === "COUNT" ? "Counted quantity" : "Quantity"} hint={`Change: ${delta > 0 ? "+" : ""}${delta} → ${current + delta}`}>
            <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} autoFocus />
          </Field>
          {reason === "ADJUST" && <CheckField label="Remove stock (negative adjustment)" checked={negative} onChange={setNegative} />}
          <Field label="Note"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier invoice, batch, reason…" /></Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementsTab({ product, onClear }: { product: PosProduct | null; onClear: () => void }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [product?.id]);
  const { data, error, loading, reload } = useApi(() => inventoryApi.movements({ productId: product?.id, page, limit: 30 }), [product?.id, page]);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {product && <p className="text-sm">Showing <strong>{product.name}</strong> · <button className="text-primary underline" onClick={onClear}>show all</button></p>}
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Stock movements</caption>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3">When</th><th scope="col" className="py-2 pr-3">Product</th><th scope="col" className="py-2 pr-3">Type</th>
                  <th scope="col" className="py-2 pr-3 text-right">Change</th><th scope="col" className="py-2 pr-3 text-right">Stock</th><th scope="col" className="py-2 pr-3">By</th><th scope="col" className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-xs">{m.createdAt && formatDateTime(m.createdAt)}</td>
                    <td className="py-2 pr-3">{m.productName}{m.variantName && <span className="text-muted-foreground"> — {m.variantName}</span>}</td>
                    <td className="py-2 pr-3 text-xs">{m.type}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                    <td className="py-2 pr-3 text-right">{m.previousStock} → {m.newStock}</td>
                    <td className="py-2 pr-3 text-xs">{m.performedByName ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">No movements yet.</p>}
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
          {!local.rejected.length && !local.conflicts.length && <p className="text-sm text-muted-foreground">No queued sales need attention on this device.</p>}
          {local.rejected.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Queued sales the server rejected / failed (kept, retried with backoff)</p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {local.rejected.map((s) => (
                  <li key={s.clientRef} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="font-mono">{s.provisionalRef}</span>
                    <span>{formatNPR(s.total)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString("en-NP")} · {s.attempts} attempts</span>
                    <span className="flex-1 text-danger">{s.lastError}</span>
                    <Button size="sm" variant="outline" onClick={async () => { await retryNow(s.clientRef); await runSyncCycle(); await loadLocal(); }}>
                      <RefreshCw className="h-3.5 w-3.5" /> Retry now
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {local.conflicts.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Synced with stock conflicts (sale recorded; stock went negative)</p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {local.conflicts.map((r) => (
                  <li key={r.clientRef} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="font-mono">{r.provisionalRef} → {r.printableRef ?? r.orderId}</span>
                    <span className="flex-1 text-xs text-muted-foreground">{r.conflicts?.map((c) => `${c.productId}: wanted ${c.requested}, had ${c.available}`).join("; ")}</span>
                    <Button size="sm" variant="ghost" onClick={async () => { await acknowledgeResult(r.clientRef); await loadLocal(); }}><Check className="h-3.5 w-3.5" /> Seen</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Server conflicts (all devices)</CardTitle>
          <Select aria-label="Conflict status" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} className="w-36">
            <option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option>
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
                  <span className="text-xs text-muted-foreground">sold {c.requested}, had {c.available} · {c.createdAt && formatDateTime(c.createdAt)}</span>
                  {c.note && <span className="text-xs text-muted-foreground">“{c.note}”</span>}
                  {c.status === "open" && <Button size="sm" className="ml-auto" onClick={() => setResolving(c)}>Resolve</Button>}
                </li>
              ))}
              {!data?.items.length && <li className="py-6 text-center text-sm text-muted-foreground">No conflicts.</li>}
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
      toast.success("Conflict resolved");
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
          <DialogTitle>Resolve stock conflict</DialogTitle>
          <DialogDescription>{conflict.productName}: sold {conflict.requested} offline while only {conflict.available} were in stock. Count the shelf and adjust stock in the Stock tab if needed, then note what you did.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Resolution note (required)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Button type="submit" className="w-full" disabled={busy || !note.trim()}>{busy ? "Saving…" : "Mark resolved"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
