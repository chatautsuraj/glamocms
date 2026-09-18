"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  ConfirmDeleteDialog,
  CreateExpenseDialog,
} from "@/components/forms/create-dialogs";
import { useAppStore, type Expense } from "@/lib/store";
import { useTenantExpenses } from "@/lib/use-tenant-data";
import { useCanDeleteRecords, useCanEditRecords } from "@/lib/use-entitlements";
import { formatDate, formatNPR } from "@/lib/format";
import { toast } from "sonner";

export default function ExpensesPage() {
  const expenses = useTenantExpenses();
  const deleteExpense = useAppStore((s) => s.deleteExpense);
  const canEdit = useCanEditRecords();
  const canDelete = useCanDeleteRecords();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const expenseColumns: Column<Expense>[] = useMemo(
    () => [
      { key: "date", header: "Date", cell: (r) => formatDate(r.date), sortValue: (r) => r.date },
      { key: "category", header: "Category", cell: (r) => r.category },
      { key: "description", header: "Description", cell: (r) => r.description },
      {
        key: "amount",
        header: "Amount",
        cell: (r) => formatNPR(r.amount),
        sortValue: (r) => r.amount,
        className: "text-right",
      },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            {canEdit && (
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
            )}
            {canDelete && (
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
            )}
          </div>
        ),
        className: "text-right",
      },
    ],
    [canEdit, canDelete]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record and manage company expenses"
        actions={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Record Expense
          </Button>
        }
      />

      <DataTable
        data={expenses}
        columns={expenseColumns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search expenses…"
        exportFilename="expenses"
      />

      <CreateExpenseDialog
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
        title="Delete expense?"
        description={
          deleteTarget
            ? `Remove “${deleteTarget.description}” (${formatNPR(deleteTarget.amount)}).`
            : ""
        }
        onConfirm={() => {
          if (!deleteTarget) return false;
          if (!canDelete) {
            toast.error("You do not have permission to delete");
            return false;
          }
          const ok = deleteExpense(deleteTarget.id);
          if (!ok) {
            toast.error("Could not delete expense");
            return false;
          }
          toast.success("Expense deleted");
          setDeleteTarget(null);
          return true;
        }}
      />
    </div>
  );
}
