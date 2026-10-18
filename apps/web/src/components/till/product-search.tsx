"use client";

import { forwardRef, useMemo, useState } from "react";
import { Camera, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PosProduct } from "@/lib/api/types";
import type { CachedProduct } from "@/lib/offline/db";
import { formatNPR } from "@/lib/format";
import { expiryState } from "@/lib/pos/sellable";
import { cn } from "@/lib/utils";

type Props = {
  products: CachedProduct[];
  /** Pick product (+ variant). */
  onPick: (p: PosProduct, variantId: string | null) => void;
  /** Exact code typed + Enter (barcode / SKU). */
  onCode: (code: string) => void;
  onCamera?: () => void;
  compact?: boolean;
};

export const ProductSearch = forwardRef<HTMLInputElement, Props>(function ProductSearch({ products, onPick, onCode, onCamera, compact }, ref) {
  const [q, setQ] = useState("");
  const [variantFor, setVariantFor] = useState<PosProduct | null>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? products.filter((p) => p.nameLower.includes(needle) || p.codes.some((c) => c.toLowerCase().includes(needle)) || p.brand?.toLowerCase().includes(needle) || p.attributes?.shade?.toLowerCase().includes(needle))
      : products;
    return list.slice(0, compact ? 24 : 60);
  }, [products, q, compact]);

  const pick = (p: PosProduct) => {
    if (p.variants.length > 0) setVariantFor(p);
    else onPick(p, null);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search products or type a barcode</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={ref}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const code = q.trim();
              if (!code) return;
              const exact = products.find((p) => p.codes.includes(code.toUpperCase()));
              if (exact || results.length !== 1) onCode(code);
              else pick(results[0]);
              setQ("");
            }}
            placeholder="Search name / brand / shade, or scan & press Enter"
            className="h-12 pl-9 text-base"
            autoComplete="off"
            inputMode="search"
          />
        </label>
        {onCamera && (
          <Button type="button" variant="outline" className="h-12 w-12 shrink-0" onClick={onCamera} aria-label="Scan with camera">
            <Camera className="h-5 w-5" />
          </Button>
        )}
      </div>
      <ul className={cn("grid gap-2 overflow-y-auto pr-1", compact ? "max-h-80 grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")} aria-label="Products">
        {results.map((p) => {
          const exp = expiryState(p.attributes?.expiry);
          const out = (p.trackInventory ?? true) && p.stock <= 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="flex h-full min-h-[84px] w-full flex-col justify-between rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {p.brand && <span>{p.brand}</span>}
                  {p.attributes?.shade && <span>· {p.attributes.shade}</span>}
                  {p.variants.length > 0 && <Badge variant="muted">{p.variants.length} shades</Badge>}
                  {p.attributes?.tester && <Badge variant="warning">Tester</Badge>}
                  {exp === "expired" && <Badge variant="danger">Expired</Badge>}
                  {exp === "soon" && <Badge variant="warning">Expiring</Badge>}
                </span>
                <span className="mt-2 flex items-center justify-between">
                  <span className="font-semibold">{formatNPR(p.price)}</span>
                  <span className={cn("text-xs", out ? "text-danger" : p.stock <= p.lowStockThreshold ? "text-warning" : "text-muted-foreground")}>
                    {out ? "Out of stock" : `${p.stock} in stock`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!results.length && <li className="col-span-full py-8 text-center text-sm text-muted-foreground">No products match “{q}”.</li>}
      </ul>

      <Dialog open={Boolean(variantFor)} onOpenChange={(o) => !o && setVariantFor(null)} label="Choose shade">
        <DialogContent onClose={() => setVariantFor(null)}>
          <DialogHeader>
            <DialogTitle>{variantFor?.name} — choose shade</DialogTitle>
          </DialogHeader>
          <ul className="grid gap-2 sm:grid-cols-2">
            {variantFor?.variants.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    if (variantFor) onPick(variantFor, v.id);
                    setVariantFor(null);
                  }}
                >
                  <span>
                    <span className="block text-sm font-medium">{v.name}</span>
                    <span className="text-xs text-muted-foreground">{v.sku ?? v.barcode ?? ""} · {v.stock} in stock</span>
                  </span>
                  <span className="font-semibold">{formatNPR(v.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
});
