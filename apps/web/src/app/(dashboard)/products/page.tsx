"use client";

import { useMemo, useState } from "react";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPhoto } from "@/components/product-photo";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/forms/create-dialogs";
import { GlamoProductDialog } from "@/components/forms/glamo-product-dialog";
import { useApiProducts, type UiProduct } from "@/lib/use-api-products";
import { commerceClient, type ApiProduct } from "@/lib/commerce-client";
import { formatNPR } from "@/lib/format";
import { toast } from "sonner";

export default function ProductsPage() {
  const { products, raw, loading, error, reload } = useApiProducts();
  const [gallery, setGallery] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ApiProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UiProduct | null>(null);

  const columns: Column<UiProduct>[] = useMemo(
    () => [
      { key: "sku", header: "SKU", cell: (r) => <span className="whitespace-nowrap font-mono text-xs">{r.sku}</span>, sortValue: (r) => r.sku },
      {
        key: "name",
        header: "Product",
        cell: (r) => (
          <div className="flex min-w-[240px] items-center gap-3">
            <ProductPhoto src={r.image} name={r.name} className="h-14 w-14 shrink-0" />
            <span className="font-medium">{r.name}</span>
          </div>
        ),
        sortValue: (r) => r.name,
      },
      { key: "size", header: "Size", cell: (r) => r.size || "—", sortValue: (r) => r.size },
      { key: "shade", header: "Shade", cell: (r) => r.shade || "—", sortValue: (r) => r.shade || "" },
      { key: "brand", header: "Brand", cell: (r) => r.brand, sortValue: (r) => r.brand },
      { key: "category", header: "Category", cell: (r) => <Badge variant="muted">{r.category}</Badge>, sortValue: (r) => r.category },
      {
        key: "galla",
        header: "Counter",
        cell: (r) =>
          r.galla !== false ? (
            <Badge variant={r.isTester ? "warning" : "success"}>{r.isTester ? "Tester" : "POS"}</Badge>
          ) : (
            <Badge variant="muted">No</Badge>
          ),
      },
      { key: "mrp", header: "MRP", cell: (r) => formatNPR(r.mrp), sortValue: (r) => r.mrp, className: "text-right" },
      { key: "trade", header: "Selling price", cell: (r) => formatNPR(r.tradePrice), sortValue: (r) => r.tradePrice, className: "text-right" },
      {
        key: "stock",
        header: "Stock",
        cell: (r) => (
          <span className={r.stock <= r.reorderAt ? "text-warning font-medium" : ""}>
            {r.stock.toLocaleString()}
          </span>
        ),
        sortValue: (r) => r.stock,
        className: "text-right",
      },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setEdit(raw.find((p) => p.id === r.id) ?? null);
                setOpen(true);
              }}
            >
              <Pencil aria-label={`Edit ${r.name}`} className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(r);
              }}
            >
              <Trash2 aria-label={`Delete ${r.name}`} className="h-3.5 w-3.5 text-danger" />
            </Button>
          </div>
        ),
        className: "text-right",
      },
    ],
    [raw],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Glamo catalog — Nest API when available, bundled catalog offline"
        actions={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        }
      />

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant={gallery ? "default" : "outline"} size="sm" onClick={() => setGallery(true)}>
          Gallery
        </Button>
        <Button variant={!gallery ? "default" : "outline"} size="sm" onClick={() => setGallery(false)}>
          Table
        </Button>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {gallery ? (
        <ProductGallery
          products={products as import("@/lib/store").Product[]}
          onEdit={(p) => {
            setEdit(raw.find((x) => x.id === p.id) ?? null);
            setOpen(true);
          }}
        />
      ) : (
        <DataTable
          data={products}
          columns={columns}
          getRowId={(r) => r.id}
          searchKeys={[(r) => r.name, (r) => r.sku, (r) => r.brand, (r) => r.category]}
          exportFilename="glamo-products"
        />
      )}

      <GlamoProductDialog open={open} onOpenChange={setOpen} edit={edit} onSaved={() => void reload()} />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete product"
        description={deleteTarget ? `Remove ${deleteTarget.name} from the shared catalog?` : ""}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await commerceClient.deleteProduct(deleteTarget.id);
            toast.success("Product deleted");
            setDeleteTarget(null);
            await reload();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}
