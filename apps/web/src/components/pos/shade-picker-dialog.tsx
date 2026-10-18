"use client";

import { ProductImage } from "@/components/product-image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PosProduct } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Choose which shade / size of a product to sell. */
export function ShadePickerDialog({ product, onPick, onClose }: { product: PosProduct | null; onPick: (p: PosProduct, variantId: string) => void; onClose: () => void }) {
  return (
    <Dialog open={Boolean(product)} onOpenChange={(o) => !o && onClose()} label="Choose shade" className="max-w-2xl">
      <DialogContent onClose={onClose}>
        {product && (
          <>
            <DialogHeader className="flex items-center gap-3 space-y-0">
              <ProductImage src={product.imageUrl} name={product.name} className="h-14 w-14 shrink-0 border border-border" />
              <div>
                <DialogTitle>{product.name}</DialogTitle>
                <DialogDescription>Choose a shade</DialogDescription>
              </div>
            </DialogHeader>
            <ul className="grid gap-2 sm:grid-cols-2">
              {product.variants.map((v) => {
                const out = (product.trackInventory ?? true) && v.stock <= 0;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => onPick(product, v.id)}
                      className={cn("flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", out && "opacity-70")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{v.name}</span>
                        <span className={cn("text-xs", out ? "font-semibold text-danger" : "text-muted-foreground")}>{out ? "Out of stock" : `${v.stock} in stock`}</span>
                      </span>
                      <span className="tabular shrink-0 text-base font-bold">{formatNPR(v.price)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
