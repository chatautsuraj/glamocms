"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, RefreshCw } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckField } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/lib/auth/auth-store";
import { digitsToInt, formatNPR, formatNumber } from "@/lib/format";
import { useOfflineStore } from "@/lib/offline/sync-runner";
import { usePosConfig } from "@/lib/pos/config-store";
import { useCatalog } from "@/lib/pos/use-catalog";
import { defaultCopies, labelRowsFor, toLabelItem, type LabelRow } from "@/lib/print/label-rows";
import { LABEL_SIZE_NAME, MAX_LABELS_PER_JOB, printLabels } from "@/lib/print/labels";
import { cn } from "@/lib/utils";

const PAGE = 100;

/**
 * Barcode label printing for many products at once: search / filter, pick
 * products and shades, set how many labels of each (default = stock), print.
 */
export function LabelPrintPanel() {
  const { products, loaded, reload } = useCatalog({ includeHidden: true });
  const syncing = useOfflineStore((s) => s.syncing);
  const labels = usePosConfig((s) => s.config?.labels ?? null);
  const canSettings = useAuthStore((s) => s.permissions.includes("settings.read"));
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => products.flatMap(labelRowsFor), [products]);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)))].sort(), [rows]);
  const shown = useMemo(() => {
    const words = query.split(/\s+/).filter(Boolean);
    return rows.filter((r) => (!category || r.category === category) && (!lowOnly || r.lowStock) && words.every((w) => r.search.includes(w)));
  }, [rows, query, category, lowOnly]);

  const printable = shown.filter((r) => r.code);
  const shownSelected = printable.filter((r) => selected.has(r.key)).length;
  const allShown = printable.length > 0 && shownSelected === printable.length;
  const labelCount = [...selected.entries()].reduce((s, [key, copies]) => s + (byKey.get(key)?.code ? digitsToInt(copies) : 0), 0);

  const toggle = (row: LabelRow, on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (on) next.set(row.key, prev.get(row.key) ?? String(defaultCopies(row.stock)));
      else next.delete(row.key);
      return next;
    });

  const toggleAll = (on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const r of shown) {
        if (!r.code) continue;
        if (on) next.set(r.key, prev.get(r.key) ?? String(defaultCopies(r.stock)));
        else next.delete(r.key);
      }
      return next;
    });

  const print = () => {
    if (!labels) return void toast.error("Label settings are still loading. Try again in a moment.");
    if (labelCount > MAX_LABELS_PER_JOB) return void toast.error(`That is ${formatNumber(labelCount)} labels. Print at most ${formatNumber(MAX_LABELS_PER_JOB)} at a time.`);
    const items = [...selected.entries()].flatMap(([key, copies]) => {
      const row = byKey.get(key);
      return row ? [toLabelItem(row, digitsToInt(copies))] : [];
    });
    if (printLabels(items, labels)) toast.success(`Printing ${formatNumber(labelCount)} labels`);
    else toast.error("Choose at least one label to print.");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <SearchInput className="min-w-[220px] flex-1" value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} label="Search products for labels" placeholder="Name, brand, shade, barcode or SKU" />
          <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setLimit(PAGE); }} className="w-48">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <CheckField label="Running low only" checked={lowOnly} onChange={(v) => { setLowOnly(v); setLimit(PAGE); }} />
          <Button variant="ghost" onClick={() => void reload()} disabled={syncing}><RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} aria-hidden /> Refresh</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2 sm:p-4">
          {!loaded ? (
            <div className="space-y-2" role="status" aria-label="Loading">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Products and shades for barcode labels</caption>
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="w-12 py-2 pl-2">
                      <input type="checkbox" className="h-5 w-5 accent-[var(--rose-dark)]" aria-label="Select all shown" checked={allShown} ref={(el) => { if (el) el.indeterminate = shownSelected > 0 && !allShown; }} onChange={(e) => toggleAll(e.target.checked)} />
                    </th>
                    <th scope="col" className="py-2 pr-3">Product</th>
                    <th scope="col" className="hidden py-2 pr-3 sm:table-cell">Barcode</th>
                    <th scope="col" className="py-2 pr-3 text-right">Price</th>
                    <th scope="col" className="py-2 pr-3 text-right">Stock</th>
                    <th scope="col" className="py-2 pr-2 text-right">Labels</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, limit).map((r) => {
                    const on = selected.has(r.key);
                    return (
                      <tr key={r.key} className={cn("cv-row border-b border-border/60", on && "bg-rose-tint/60")}>
                        <td className="py-1.5 pl-2">
                          <input type="checkbox" className="h-5 w-5 accent-[var(--rose-dark)]" aria-label={`Select ${r.name}${r.variant ? ` ${r.variant}` : ""}`} checked={on} disabled={!r.code} onChange={(e) => toggle(r, e.target.checked)} />
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <ProductImage src={r.imageUrl} name={r.name} className="h-10 w-10 shrink-0 border border-border" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{[r.variant, r.brand].filter(Boolean).join(" · ")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden py-1.5 pr-3 font-mono text-xs sm:table-cell">{r.code || <span className="text-warning">No barcode</span>}</td>
                        <td className="tabular py-1.5 pr-3 text-right">{formatNPR(r.price)}</td>
                        <td className={cn("tabular py-1.5 pr-3 text-right", r.lowStock && "font-semibold text-warning")}>{r.stock}</td>
                        <td className="py-1.5 pr-2 text-right">
                          <input
                            inputMode="numeric"
                            aria-label={`Labels for ${r.name}${r.variant ? ` ${r.variant}` : ""}`}
                            className="tabular h-10 w-20 rounded-md border border-input bg-card px-2 text-right text-sm focus-visible:border-ring focus-visible:outline-none disabled:opacity-40"
                            value={selected.get(r.key) ?? ""}
                            placeholder={String(defaultCopies(r.stock))}
                            disabled={!r.code}
                            onFocus={() => !on && r.code && toggle(r, true)}
                            onChange={(e) => setSelected((prev) => new Map(prev).set(r.key, e.target.value.replace(/\D/g, "")))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!shown.length && <p className="py-10 text-center text-sm text-muted-foreground">{rows.length ? "Nothing matches these filters." : "No products on this device yet. Press Refresh."}</p>}
              {limit < shown.length && (
                <div className="py-3 text-center">
                  <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Show more ({formatNumber(shown.length - limit)} left)</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-pop">
        <p className="text-sm">
          <strong>{formatNumber(selected.size)}</strong> selected · <strong className="tabular">{formatNumber(labelCount)}</strong> labels
          <span className="text-muted-foreground"> · {labels ? LABEL_SIZE_NAME[labels.size] : "…"}</span>
          {canSettings && <Link href="/settings?tab=labels" className="ml-2 text-primary underline">Change</Link>}
        </p>
        {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>Clear</Button>}
        <Button variant="brand" size="lg" className="ml-auto" onClick={print} disabled={!labelCount || !labels}>
          <Printer className="h-5 w-5" aria-hidden /> Print {formatNumber(labelCount)} labels
        </Button>
      </div>
    </div>
  );
}
