"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Phone, Receipt, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ConfirmDeleteDialog,
  CreateCustomerDialog,
} from "@/components/forms/create-dialogs";
import { useAppStore, type Invoice } from "@/lib/store";
import { useTenantInvoices } from "@/lib/use-tenant-data";
import { formatDate, formatNPR } from "@/lib/format";
import { toast } from "sonner";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const customers = useAppStore((s) => s.customers);
  const deleteCustomer = useAppStore((s) => s.deleteCustomer);
  const customer = customers.find((c) => c.id === id);
  const invoices = useTenantInvoices();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const history = useMemo(
    () =>
      customer
        ? invoices.filter((i) => i.customerId === customer.id || i.customer === customer.name)
        : [],
    [invoices, customer],
  );

  if (!customer) notFound();

  const creditUsed = customer.creditLimit
    ? (customer.outstanding / customer.creditLimit) * 100
    : 0;

  const columns: Column<Invoice>[] = [
    { key: "number", header: "Invoice", cell: (r) => r.number },
    { key: "date", header: "Date", cell: (r) => formatDate(r.date), sortValue: (r) => r.date },
    { key: "total", header: "Total", cell: (r) => formatNPR(r.total), sortValue: (r) => r.total },
    { key: "due", header: "Due", cell: (r) => (r.due > 0 ? formatNPR(r.due) : "—") },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <Link href="/customers">
        <Button variant="ghost" size="sm" className="mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Button>
      </Link>

      <PageHeader
        title={customer.name}
        description={`${customer.code} · ${customer.area} · ${customer.type.replace(/_/g, " ")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 text-danger" /> Delete
            </Button>
            <Button variant="outline">
              <Phone className="h-4 w-4" /> {customer.phone}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Lifetime Value" value={formatNPR(customer.lifetime, true)} />
        <StatCard
          title="Outstanding"
          value={formatNPR(customer.outstanding)}
          subtitle={`Limit ${formatNPR(customer.creditLimit)}`}
        />
        <StatCard
          title="Total Orders"
          value={customer.orders}
          subtitle={`Last: ${formatDate(customer.lastOrder)}`}
        />
        <StatCard
          title="Risk Score"
          value={customer.riskScore}
          subtitle={customer.riskScore >= 60 ? "High risk" : "Normal"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Credit Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Credit utilization</span>
                <span className="font-medium">{creditUsed.toFixed(0)}%</span>
              </div>
              <Progress value={creditUsed} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit limit</span>
                <span>{formatNPR(customer.creditLimit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="text-warning">{formatNPR(customer.outstanding)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available</span>
                <span className="text-success">
                  {formatNPR(customer.creditLimit - customer.outstanding)}
                </span>
              </div>
            </div>
            {customer.riskScore >= 60 && (
              <Badge variant="danger">Collection visit recommended</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={history}
              columns={columns}
              getRowId={(r) => r.id}
              pageSize={5}
              exportFilename={`customer-${customer.code}`}
            />
          </CardContent>
        </Card>
      </div>

      <CreateCustomerDialog open={editOpen} onOpenChange={setEditOpen} edit={customer} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete customer?"
        description={`Remove ${customer.name} (${customer.code}) from this client workspace.`}
        onConfirm={() => {
          const ok = deleteCustomer(customer.id);
          if (!ok) {
            toast.error("Could not delete customer");
            return false;
          }
          toast.success("Customer deleted");
          router.push("/customers");
          return true;
        }}
      />
    </div>
  );
}
