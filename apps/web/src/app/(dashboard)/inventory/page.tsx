"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Barcode, Boxes, PackagePlus } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiProducts, type UiProduct, invalidateProductCache } from "@/lib/use-api-products";
import { commerceClient } from "@/lib/commerce-client";
import { formatNPR } from "@/lib/format";
import { printStockBarcodes } from "@/lib/print-barcodes";
import { toast } from "sonner";

export default function InventoryPage() {
  const { products, loading, error, reload } = useApiProducts();
  const [target, setTarget] = useState<UiProduct | null>(null);
  const [qty, setQty] = useState("10");
  const [busy, setBusy] = useState(false);

  const inventory = useMemo(
    () =>
      products.map((p) => ({
        ...p,
        status: p.stock <= p.reorderAt ? (p.stock < p.reorderAt * 0.3 ? "critical" : "low") : "ok",
        value: p.stock * p.tradePrice,
      })),
    [products],
  );

  const critical = inventory.filter((i) => i.status === "critical").length;
  const low = inventory.filter((i) => i.status === "low").length;

  const columns: Column<(typeof inventory)[0]>[] = [
    { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
    { key: "name", header: "Product", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: "stock", header: "Stock", cell: (r) => r.stock, className: "text-right", sortValue: (r) => r.stock },
    { key: "reorder", header: "Reorder", cell: (r) => r.reorderAt, className: "text-right" },
    { key: "value", header: "Value", cell: (r) => formatNPR(r.value), className: "text-right", sortValue: (r) => r.value },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className={r.status === "ok" ? "text-success" : r.status === "low" ? "text-warning" : "text-danger"}>
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            title="Print barcode"
            onClick={(e) => {
              e.stopPropagation();
              const ok = printStockBarcodes([
                { sku: r.sku, name: r.name, price: r.tradePrice, copies: 1 },
              ]);
              if (!ok) toast.error("Allow pop-ups to print barcode");
            }}
          >
            <Barcode className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setTarget(r);
              setQty("10");
            }}
          >
            <PackagePlus className="h-3.5 w-3.5" /> Adjust
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  const applyAdjust = async (delta: number) => {
    if (!target || !delta) return;
    setBusy(true);
    try {
      await commerceClient.adjustStock({
        productId: target.id,
        qty: delta,
        reason: delta > 0 ? "receive" : "adjust_out",
        currentStock: target.stock,
      });
      invalidateProductCache();
      toast.success(delta > 0 ? `Received +${delta}` : `Removed ${Math.abs(delta)}`);
      setTarget(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Adjust failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels shared with Products — add opening stock when creating a SKU, adjust here anytime"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory/barcodes">
              <Button variant="outline">
                <Barcode className="h-4 w-4" /> Barcodes
              </Button>
            </Link>
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              <Boxes className="h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="SKUs" value={String(products.length)} icon={Boxes} />
        <StatCard title="Low stock" value={String(low)} icon={Boxes} />
        <StatCard title="Critical" value={String(critical)} icon={Boxes} />
      </div>

      <DataTable
        data={inventory}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.sku, (r) => r.brand]}
        exportFilename="glamo-inventory"
      />

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)} className="max-w-md">
        <DialogContent onClose={() => setTarget(null)}>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {target?.name} — current {target?.stock}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void applyAdjust(-(Number(qty) || 0))}>
                Remove
              </Button>
              <Button disabled={busy} onClick={() => void applyAdjust(Number(qty) || 0)}>
                Receive / add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
