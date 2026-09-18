"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ConfirmDeleteDialog,
  CreateCustomerDialog,
} from "@/components/forms/create-dialogs";
import { commerceClient } from "@/lib/commerce-client";
import { useAppStore, type Customer } from "@/lib/store";
import { syncCallerToAppStore } from "@/lib/sync-caller";
import { useTenantCustomers } from "@/lib/use-tenant-data";
import { formatDate, formatNPR } from "@/lib/format";
import { toast } from "sonner";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function CustomersPage() {
  const storeCustomers = useTenantCustomers();
  const activeTenantId = useAppStore((s) => s.activeTenantId);
  const deleteCustomer = useAppStore((s) => s.deleteCustomer);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [commerceExtras, setCommerceExtras] = useState<Customer[]>([]);

  // Pull POS / Phone callers from local commerce into this list (+ Zustand).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { customers } = await commerceClient.listCustomers();
        if (cancelled || !activeTenantId) return;

        const storePhones = new Set(
          useAppStore
            .getState()
            .customers.filter((c) => c.tenantId === activeTenantId)
            .map((c) => c.phone)
            .filter(Boolean),
        );

        const extras: Customer[] = [];
        for (const c of customers) {
          if (!c.phone || !c.name) continue;
          if (!storePhones.has(c.phone)) {
            syncCallerToAppStore({
              name: c.name,
              phone: c.phone,
              area: c.deliveryAddress || (c.sourceChannel === "phone" ? "Phone" : "Walk-in / Phone"),
            });
            storePhones.add(c.phone);
          }
          // Fallback rows if Zustand sync skipped (no active tenant mid-load)
          extras.push({
            id: c.id,
            code: `CALL-${c.phone.slice(-4)}`,
            name: c.name,
            type: "INDIVIDUAL",
            phone: c.phone,
            area: c.deliveryAddress || (c.sourceChannel === "phone" ? "Phone" : "Walk-in / Phone"),
            creditLimit: 0,
            outstanding: 0,
            riskScore: 10,
            lastOrder: (c.createdAt ?? todayIsoDate()).slice(0, 10),
            orders: c._count?.orders ?? 0,
            lifetime: 0,
            tenantId: activeTenantId,
          });
        }
        if (!cancelled) setCommerceExtras(extras);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  const customers = useMemo(() => {
    const byPhone = new Map<string, Customer>();
    const byId = new Map<string, Customer>();
    for (const c of storeCustomers) {
      byId.set(c.id, c);
      if (c.phone) byPhone.set(c.phone, c);
    }
    for (const c of commerceExtras) {
      if (byId.has(c.id)) continue;
      if (c.phone && byPhone.has(c.phone)) continue;
      byId.set(c.id, c);
      if (c.phone) byPhone.set(c.phone, c);
    }
    return [...byId.values()];
  }, [storeCustomers, commerceExtras]);

  const columns: Column<Customer>[] = useMemo(
    () => [
      { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span>, sortValue: (r) => r.code },
      {
        key: "name",
        header: "Customer",
        cell: (r) => (
          <Link href={`/customers/${r.id}`} className="font-medium hover:text-primary">
            {r.name}
          </Link>
        ),
        sortValue: (r) => r.name,
      },
      { key: "type", header: "Type", cell: (r) => <Badge variant="muted">{r.type.replace(/_/g, " ")}</Badge> },
      { key: "area", header: "Area", cell: (r) => r.area, sortValue: (r) => r.area },
      { key: "outstanding", header: "Outstanding", cell: (r) => formatNPR(r.outstanding), sortValue: (r) => r.outstanding, className: "text-right" },
      {
        key: "credit",
        header: "Credit Used",
        cell: (r) => {
          const pct = r.creditLimit ? (r.outstanding / r.creditLimit) * 100 : 0;
          return (
            <div className="w-24">
              <Progress value={pct} className="h-1.5" />
              <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
            </div>
          );
        },
      },
      {
        key: "risk",
        header: "Risk",
        cell: (r) => (
          <span className={r.riskScore >= 60 ? "text-danger font-medium" : r.riskScore >= 40 ? "text-warning" : "text-success"}>
            {r.riskScore}
          </span>
        ),
        sortValue: (r) => r.riskScore,
        className: "text-right",
      },
      { key: "lastOrder", header: "Last Order", cell: (r) => formatDate(r.lastOrder), sortValue: (r) => r.lastOrder },
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
        title="Customers"
        description="Customers, salons, bridal studios and spas — includes POS & phone callers"
        actions={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />
      <DataTable
        data={customers}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.code, (r) => r.area, (r) => r.phone]}
        exportFilename="customers"
        selectable
      />
      <CreateCustomerDialog
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
        title="Delete customer?"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.name} (${deleteTarget.code}) from this client workspace. This cannot be undone in the demo store.`
            : ""
        }
        onConfirm={() => {
          if (!deleteTarget) return false;
          const ok = deleteCustomer(deleteTarget.id);
          if (!ok) {
            toast.error("Could not delete customer");
            return false;
          }
          toast.success("Customer deleted");
          setDeleteTarget(null);
          return true;
        }}
      />
    </div>
  );
}
