"use client";

import { useEffect, useMemo, useState } from "react";
import { Barcode, Boxes, PackagePlus, Printer } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [supplier, setSupplier] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [copies, setCopies] = useState("1");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("receive") === "1" && products[0]) {
      setTarget(products[0]);
      setQty("10");
    }
  }, [products]);

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
  const picked = inventory.filter((i) => selected[i.id]);

  const printLabels = (list: typeof inventory) => {
    if (!list.length) {
      toast.error("No products to print");
      return;
    }
    const n = Math.max(1, Math.min(20, Math.floor(Number(copies) || 1)));
    const ok = printStockBarcodes(
      list.map((p) => ({ sku: p.sku, name: p.name, price: p.tradePrice, copies: n })),
    );
    if (!ok) toast.error("Allow pop-ups to print barcodes");
    else toast.success(`Printing ${list.length} SKU label(s)`);
  };

  const applyReceive = async () => {
    if (!target) return;
    const delta = Math.floor(Number(qty) || 0);
    if (delta <= 0) {
      toast.error("Enter a quantity");
      return;
    }
    setBusy(true);
    try {
      const cost = Number(unitCost) || 0;
      if (supplier.trim()) {
        await commerceClient.receivePurchase({
          supplierName: supplier.trim(),
          lines: [{ productId: target.id, qty: delta, unitCost: cost || undefined }],
        });
      } else {
        await commerceClient.adjustStock({
          productId: target.id,
          qty: delta,
          reason: "receive",
          currentStock: target.stock,
        });
      }
      invalidateProductCache();
      toast.success(`Stock +${delta} on ${target.name}`);
      setTarget(null);
      setSupplier("");
      setUnitCost("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  const applyRemove = async () => {
    if (!target) return;
    const delta = Math.floor(Number(qty) || 0);
    if (delta <= 0) return;
    setBusy(true);
    try {
      await commerceClient.adjustStock({
        productId: target.id,
        qty: -delta,
        reason: "adjust_out",
        currentStock: target.stock,
      });
      invalidateProductCache();
      toast.success(`Removed ${delta}`);
      setTarget(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Adjust failed");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<(typeof inventory)[0]>[] = [
    {
      key: "pick",
      header: "",
      cell: (r) => (
        <Checkbox
          checked={!!selected[r.id]}
          onChange={() => setSelected((s) => ({ ...s, [r.id]: !s[r.id] }))}
          aria-label={`Select ${r.name}`}
        />
      ),
    },
    { key: "sku", header: "SKU / barcode", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
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
              printLabels([r]);
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
              setSupplier("");
              setUnitCost("");
            }}
          >
            <PackagePlus className="h-3.5 w-3.5" /> Receive
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Receive stock, print barcodes, and adjust on-hand — same catalog as Products"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Barcode copies</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="h-9 w-20"
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={loading || inventory.length === 0}
              onClick={() => printLabels(picked.length ? picked : inventory)}
            >
              <Printer className="h-4 w-4" />
              Print {picked.length ? picked.length : "all"} barcodes
            </Button>
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
            <DialogTitle>Receive / adjust stock</DialogTitle>
            <DialogDescription>
              {target?.name} — on hand {target?.stock}. Quantity updates inventory immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Supplier (optional)</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Leave blank for a simple stock adjust"
              />
            </div>
            <div className="space-y-1">
              <Label>Unit cost (optional, for margin)</Label>
              <Input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void applyRemove()}>
                Remove
              </Button>
              <Button disabled={busy} onClick={() => void applyReceive()}>
                Receive into stock
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
