"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  ConfirmDeleteDialog,
  CreatePurchaseOrderDialog,
} from "@/components/forms/create-dialogs";
import { useAppStore, type PurchaseOrder } from "@/lib/store";
import { useTenantPurchaseOrders } from "@/lib/use-tenant-data";
import { formatDate, formatNPR } from "@/lib/format";
import { toast } from "sonner";

export default function PurchasePage() {
  const purchaseOrders = useTenantPurchaseOrders();
  const deletePurchaseOrder = useAppStore((s) => s.deletePurchaseOrder);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<PurchaseOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const columns: Column<PurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #", cell: (r) => <span className="font-medium">{r.number}</span>, sortValue: (r) => r.number },
      { key: "supplier", header: "Supplier", cell: (r) => r.supplier, sortValue: (r) => r.supplier },
      { key: "date", header: "Date", cell: (r) => formatDate(r.date), sortValue: (r) => r.date },
      {
        key: "lines",
        header: "Lines",
        cell: (r) =>
          r.items?.length ? (
            <span className="text-xs text-muted-foreground">{r.items.length} SKU</span>
          ) : (
            <span className="text-xs text-muted-foreground">Estimate</span>
          ),
        sortValue: (r) => r.items?.length ?? 0,
      },
      { key: "total", header: "Total", cell: (r) => formatNPR(r.total), sortValue: (r) => r.total, className: "text-right" },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
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
                setEdit(r);
                setOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(r);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-danger" />
            </Button>
          </div>
        ),
        className: "text-right",
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Procurement from suppliers and GRN tracking"
        actions={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New PO
          </Button>
        }
      />
      <DataTable
        data={purchaseOrders}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.number, (r) => r.supplier]}
        exportFilename="purchase-orders"
      />
      <CreatePurchaseOrderDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEdit(null);
        }}
        edit={edit}
      />
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Delete purchase order?"
        description={deleteTarget ? `Remove ${deleteTarget.number} (${deleteTarget.supplier}).` : ""}
        onConfirm={() => {
          if (!deleteTarget) return false;
          const ok = deletePurchaseOrder(deleteTarget.id);
          if (!ok) {
            toast.error("Could not delete purchase order");
            return false;
          }
          toast.success("Purchase order deleted");
          setDeleteTarget(null);
          return true;
        }}
      />
    </div>
  );
}
