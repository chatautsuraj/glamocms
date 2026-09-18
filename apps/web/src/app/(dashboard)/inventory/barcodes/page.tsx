"use client";

import { useMemo, useState } from "react";
import { Barcode, Printer } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useApiProducts, type UiProduct } from "@/lib/use-api-products";
import { formatNPR } from "@/lib/format";
import { printStockBarcodes } from "@/lib/print-barcodes";
import { toast } from "sonner";

export default function StockBarcodesPage() {
  const { products, loading, error } = useApiProducts();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [copies, setCopies] = useState("1");
  const [onlyLow, setOnlyLow] = useState(false);

  const rows = useMemo(() => {
    let list = products;
    if (onlyLow) list = list.filter((p) => p.stock <= p.reorderAt);
    return list;
  }, [products, onlyLow]);

  const selectedList = rows.filter((p) => selected[p.id]);

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    for (const p of rows) next[p.id] = true;
    setSelected(next);
  };

  const clearAll = () => setSelected({});

  const printSelected = () => {
    const list = selectedList.length ? selectedList : rows;
    if (!list.length) {
      toast.error("No products to print");
      return;
    }
    const n = Math.max(1, Math.min(20, Math.floor(Number(copies) || 1)));
    const ok = printStockBarcodes(
      list.map((p) => ({
        sku: p.sku,
        name: p.name,
        price: p.tradePrice,
        copies: n,
      })),
    );
    if (!ok) toast.error("Allow pop-ups to print barcodes");
    else toast.success(`Printing ${list.length} SKU label(s)`);
  };

  const columns: Column<UiProduct>[] = [
    {
      key: "pick",
      header: "",
      cell: (r) => (
        <Checkbox
          checked={!!selected[r.id]}
          onChange={() => toggle(r.id)}
          aria-label={`Select ${r.name}`}
        />
      ),
    },
    { key: "sku", header: "SKU / barcode", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
    { key: "name", header: "Product", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: "stock", header: "Stock", cell: (r) => r.stock, className: "text-right", sortValue: (r) => r.stock },
    {
      key: "price",
      header: "Price",
      cell: (r) => formatNPR(r.tradePrice),
      className: "text-right",
      sortValue: (r) => r.tradePrice,
    },
    {
      key: "print",
      header: "",
      cell: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            const ok = printStockBarcodes([
              { sku: r.sku, name: r.name, price: r.tradePrice, copies: Math.max(1, Math.floor(Number(copies) || 1)) },
            ]);
            if (!ok) toast.error("Allow pop-ups to print");
          }}
        >
          <Barcode className="h-3.5 w-3.5" /> Print
        </Button>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock barcodes"
        description="Generate Code128 labels from SKU — stick on stock for USB scan at POS"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Copies each</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="h-9 w-20"
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={selectAll} disabled={loading}>
              Select all
            </Button>
            <Button variant="outline" onClick={clearAll}>
              Clear
            </Button>
            <Button onClick={printSelected} disabled={loading || rows.length === 0}>
              <Printer className="h-4 w-4" />
              Print {selectedList.length ? selectedList.length : "all"}
            </Button>
          </div>
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
        Only low / reorder stock (stock watch)
      </label>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.sku, (r) => r.brand]}
        exportFilename="glamo-stock-barcodes"
      />
    </div>
  );
}
