"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  ConfirmDeleteDialog,
  CreateSupplierDialog,
} from "@/components/forms/create-dialogs";
import { useAppStore, type Supplier } from "@/lib/store";
import { useTenantSuppliers } from "@/lib/use-tenant-data";
import { formatNPR } from "@/lib/format";
import { toast } from "sonner";

export default function SuppliersPage() {
  const suppliers = useTenantSuppliers();
  const deleteSupplier = useAppStore((s) => s.deleteSupplier);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const columns: Column<Supplier>[] = useMemo(
    () => [
      { key: "name", header: "Supplier", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
      { key: "contact", header: "Contact", cell: (r) => r.contact },
      { key: "phone", header: "Phone", cell: (r) => r.phone },
      {
        key: "pan",
        header: "PAN",
        cell: (r) => (r.pan ? <span className="font-mono text-xs">{r.pan}</span> : "—"),
        sortValue: (r) => r.pan || "",
      },
      { key: "products", header: "Products", cell: (r) => r.products, sortValue: (r) => r.products, className: "text-right" },
      {
        key: "outstanding",
        header: "Payable",
        cell: (r) => (r.outstanding > 0 ? formatNPR(r.outstanding) : "—"),
        sortValue: (r) => r.outstanding,
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
        title="Suppliers"
        description="Vendor accounts and outstanding payables"
        actions={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        }
      />
      <DataTable
        data={suppliers}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.contact, (r) => r.phone, (r) => r.pan || ""]}
        exportFilename="suppliers"
      />
      <CreateSupplierDialog
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
        title="Delete supplier?"
        description={deleteTarget ? `Remove ${deleteTarget.name} from this client workspace.` : ""}
        onConfirm={() => {
          if (!deleteTarget) return false;
          const ok = deleteSupplier(deleteTarget.id);
          if (!ok) {
            toast.error("Could not delete supplier");
            return false;
          }
          toast.success("Supplier deleted");
          setDeleteTarget(null);
          return true;
        }}
      />
    </div>
  );
}
