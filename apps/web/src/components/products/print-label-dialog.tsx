"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PosProduct } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { digitsToInt, formatNPR } from "@/lib/format";
import { usePosConfig } from "@/lib/pos/config-store";
import { defaultCopies, labelRowsFor, toLabelItem } from "@/lib/print/label-rows";
import { LABEL_SIZE_NAME, MAX_LABELS_PER_JOB, printLabels } from "@/lib/print/labels";

/** "Print label" for one product (and each of its shades): how many labels of each. */
export function PrintLabelDialog({ product, onClose }: { product: PosProduct | null; onClose: () => void }) {
  const labels = usePosConfig((s) => s.config?.labels ?? null);
  const canSettings = useAuthStore((s) => s.permissions.includes("settings.read"));
  const rows = useMemo(() => (product ? labelRowsFor(product) : []), [product]);
  const [copies, setCopies] = useState<Record<string, string>>({});

  useEffect(() => {
    setCopies(Object.fromEntries(rows.map((r) => [r.key, String(defaultCopies(r.stock))])));
  }, [rows]);

  const total = rows.reduce((s, r) => s + digitsToInt(copies[r.key] ?? "0"), 0);
  const missing = rows.filter((r) => !r.code);

  const print = () => {
    if (!labels) return void toast.error("Label settings are still loading. Try again in a moment.");
    if (total > MAX_LABELS_PER_JOB) return void toast.error(`Print at most ${MAX_LABELS_PER_JOB} labels at a time.`);
    const ok = printLabels(rows.map((r) => toLabelItem(r, digitsToInt(copies[r.key] ?? "0"))), labels);
    if (ok) {
      toast.success(`Printing ${total} ${total === 1 ? "label" : "labels"}`);
      onClose();
    } else toast.error("Nothing to print. Set how many labels you need.");
  };

  return (
    <Dialog open={Boolean(product)} onOpenChange={(o) => !o && onClose()} label="Print labels" className="max-w-lg">
      <DialogContent onClose={onClose}>
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>Print barcode labels</DialogTitle>
              <DialogDescription>
                {product.name} · {labels ? LABEL_SIZE_NAME[labels.size] : "…"}.
                {canSettings && <> Label size is set in <Link href="/settings?tab=labels" className="font-medium text-primary underline">Settings</Link>.</>}
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); print(); }}>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {rows.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.variant ?? r.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{r.code || "No barcode yet"} · {formatNPR(r.price)} · {r.stock} in stock</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Labels
                      <input
                        inputMode="numeric"
                        aria-label={`Number of labels for ${r.variant ?? r.name}`}
                        className="tabular h-11 w-20 rounded-md border border-input bg-card px-2 text-base text-foreground focus-visible:border-ring focus-visible:outline-none"
                        value={copies[r.key] ?? ""}
                        onChange={(e) => setCopies({ ...copies, [r.key]: e.target.value.replace(/\D/g, "") })}
                        disabled={!r.code}
                      />
                    </label>
                  </li>
                ))}
              </ul>
              {missing.length > 0 && <p className="text-xs text-warning">Some items have no barcode yet. Open the product and press Generate.</p>}
              <Button type="submit" variant="brand" size="lg" className="w-full" disabled={!total || !labels}>
                <Printer className="h-5 w-5" aria-hidden /> Print {total} {total === 1 ? "label" : "labels"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
