"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  ConfirmDeleteDialog,
  CreateInvoiceDialog,
  EditInvoiceDialog,
} from "@/components/forms/create-dialogs";
import { InvoiceDetailDialog } from "@/components/sales/invoice-detail";
import { useAppStore, type Invoice } from "@/lib/store";
import { useTenantInvoices } from "@/lib/use-tenant-data";
import { formatDate, formatNPR } from "@/lib/format";
import { toast } from "sonner";

export default function SalesPage() {
  const invoices = useTenantInvoices();
  const deleteInvoice = useAppStore((s) => s.deleteInvoice);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const columns: Column<Invoice>[] = useMemo(
    () => [
      { key: "number", header: "Invoice", cell: (r) => <span className="font-medium text-primary">{r.number}</span>, sortValue: (r) => r.number },
      { key: "customer", header: "Customer", cell: (r) => r.customer, sortValue: (r) => r.customer },
      { key: "date", header: "Date", cell: (r) => formatDate(r.date), sortValue: (r) => r.date },
      {
        key: "items",
        header: "Items",
        cell: (r) => (r.items?.length ? r.items.reduce((s, i) => s + i.qty, 0) : "—"),
        sortValue: (r) => r.items?.reduce((s, i) => s + i.qty, 0) ?? 0,
        className: "text-right",
      },
      { key: "method", header: "Method", cell: (r) => <span className="text-muted-foreground">{r.method.replace(/_/g, " ")}</span> },
      { key: "total", header: "Total", cell: (r) => formatNPR(r.total), sortValue: (r) => r.total, className: "text-right" },
      {
        key: "due",
        header: "Due",
        cell: (r) => (r.due > 0 ? <span className="text-warning">{formatNPR(r.due)}</span> : "—"),
        sortValue: (r) => r.due,
        className: "text-right",
      },
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
                setEditTarget(r);
                setEditOpen(true);
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
        title="Sales & Invoices"
        description="Click an invoice to view items, print, or record collections"
        actions={
          <>
            <Link href="/sales/galla">
              <Button variant="outline">Open Beauty Counter</Button>
            </Link>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </>
        }
      />
      <DataTable
        data={invoices}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.number, (r) => r.customer, (r) => r.status]}
        searchPlaceholder="Search invoices..."
        exportFilename="invoices"
        selectable
        onRowClick={(row) => {
          setSelected(row);
          setDetailOpen(true);
        }}
      />
      <CreateInvoiceDialog open={open} onOpenChange={setOpen} />
      <InvoiceDetailDialog
        invoice={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <EditInvoiceDialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditTarget(null);
        }}
        invoice={editTarget}
      />
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Delete invoice?"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.number}. Outstanding due will be reversed and stock restored when line items exist.`
            : ""
        }
        onConfirm={() => {
          if (!deleteTarget) return false;
          const ok = deleteInvoice(deleteTarget.id);
          if (!ok) {
            toast.error("Could not delete invoice");
            return false;
          }
          toast.success("Invoice deleted");
          setDeleteTarget(null);
          return true;
        }}
      />
    </div>
  );
}
