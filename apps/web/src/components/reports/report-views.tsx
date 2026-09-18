"use client";

import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CASH_FLOW,
  DASHBOARD_KPIS,
  DELIVERIES,
  SALES_TEAM,
  SALES_TREND,
  TOP_PRODUCTS,
} from "@/lib/mock-data";
import { formatDate, formatNPR, formatPercent, VAT_RATE } from "@/lib/format";
import { useCurrentTenant, useVatEnabled } from "@/lib/use-entitlements";
import {
  useTenantCustomers,
  useTenantExpenses,
  useTenantFiltered,
  useTenantInvoices,
  useTenantProducts,
  useTenantPurchaseOrders,
} from "@/lib/use-tenant-data";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Package,
  Receipt,
  Target,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

function agingBucket(lastOrder: string, outstanding: number): string {
  if (outstanding <= 0) return "Current";
  const days = Math.max(
    0,
    Math.floor(
      (Date.UTC(2026, 7, 4) - new Date(lastOrder).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  if (days <= 7) return "0–7 days";
  if (days <= 30) return "8–30 days";
  if (days <= 60) return "31–60 days";
  return "60+ days";
}

export function DailySalesReport() {
  const invoices = useTenantInvoices();
  const byDate = useMemo(() => {
    const map = new Map<
      string,
      { date: string; invoices: number; sales: number; collected: number; due: number }
    >();
    for (const inv of invoices) {
      const row = map.get(inv.date) ?? {
        date: inv.date,
        invoices: 0,
        sales: 0,
        collected: 0,
        due: 0,
      };
      row.invoices += 1;
      row.sales += inv.total;
      row.collected += inv.total - inv.due;
      row.due += inv.due;
      map.set(inv.date, row);
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices]);

  const totalSales = byDate.reduce((s, r) => s + r.sales, 0);
  const totalCollected = byDate.reduce((s, r) => s + r.collected, 0);

  const columns: Column<(typeof byDate)[0]>[] = [
    {
      key: "date",
      header: "Date",
      cell: (r) => formatDate(r.date),
      sortValue: (r) => r.date,
    },
    {
      key: "invoices",
      header: "Invoices",
      cell: (r) => r.invoices,
      sortValue: (r) => r.invoices,
      className: "text-right",
    },
    {
      key: "sales",
      header: "Sales",
      cell: (r) => formatNPR(r.sales),
      sortValue: (r) => r.sales,
      className: "text-right",
    },
    {
      key: "collected",
      header: "Collected",
      cell: (r) => formatNPR(r.collected),
      sortValue: (r) => r.collected,
      className: "text-right",
    },
    {
      key: "due",
      header: "Outstanding",
      cell: (r) =>
        r.due > 0 ? (
          <span className="text-warning">{formatNPR(r.due)}</span>
        ) : (
          "—"
        ),
      sortValue: (r) => r.due,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Period Sales" value={formatNPR(totalSales, true)} icon={Receipt} />
        <StatCard
          title="Collected"
          value={formatNPR(totalCollected, true)}
          icon={Banknote}
        />
        <StatCard title="Invoice Days" value={byDate.length} icon={Receipt} />
      </div>
      <DataTable
        data={byDate}
        columns={columns}
        getRowId={(r) => r.date}
        searchKeys={[(r) => r.date]}
        searchPlaceholder="Search by date..."
        exportFilename="daily-sales"
      />
    </div>
  );
}

export function SalesByCustomerReport() {
  const customers = useTenantCustomers();
  const invoices = useTenantInvoices();

  const rows = useMemo(() => {
    return customers
      .map((c) => {
        const custInvs = invoices.filter(
          (i) => i.customerId === c.id || i.customer === c.name
        );
        const invoiceSales = custInvs.reduce((s, i) => s + i.total, 0);
        return {
          id: c.id,
          name: c.name,
          area: c.area,
          type: c.type,
          orders: c.orders,
          sales: invoiceSales || c.lifetime,
          outstanding: c.outstanding,
        };
      })
      .sort((a, b) => b.sales - a.sales);
  }, [customers, invoices]);

  const columns: Column<(typeof rows)[0]>[] = [
    {
      key: "name",
      header: "Customer",
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    { key: "area", header: "Area", cell: (r) => r.area },
    {
      key: "type",
      header: "Type",
      cell: (r) => r.type.replace(/_/g, " "),
    },
    {
      key: "orders",
      header: "Orders",
      cell: (r) => r.orders,
      sortValue: (r) => r.orders,
      className: "text-right",
    },
    {
      key: "sales",
      header: "Sales",
      cell: (r) => formatNPR(r.sales),
      sortValue: (r) => r.sales,
      className: "text-right",
    },
    {
      key: "outstanding",
      header: "Outstanding",
      cell: (r) =>
        r.outstanding > 0 ? (
          <span className="text-warning">{formatNPR(r.outstanding)}</span>
        ) : (
          "—"
        ),
      sortValue: (r) => r.outstanding,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Accounts" value={rows.length} icon={Users} />
        <StatCard
          title="Total Revenue"
          value={formatNPR(
            rows.reduce((s, r) => s + r.sales, 0),
            true
          )}
          icon={Receipt}
        />
        <StatCard
          title="Outstanding"
          value={formatNPR(
            rows.reduce((s, r) => s + r.outstanding, 0),
            true
          )}
          icon={Wallet}
        />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.area]}
        searchPlaceholder="Search customers..."
        exportFilename="sales-by-customer"
      />
    </div>
  );
}

export function SalesByProductReport() {
  const products = useTenantFiltered(TOP_PRODUCTS);
  const catalog = useTenantProducts();

  const rows = useMemo(() => {
    if (products.length) return products;
    return catalog.map((p) => ({
      id: p.id,
      name: `${p.name} ${p.size}`,
      brand: p.brand,
      qty: p.stock,
      revenue: p.stock * p.tradePrice,
      tenantId: p.tenantId,
    }));
  }, [products, catalog]);

  const columns: Column<(typeof rows)[0]>[] = [
    {
      key: "name",
      header: "Product",
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    { key: "brand", header: "Brand", cell: (r) => r.brand },
    {
      key: "qty",
      header: "Qty Sold",
      cell: (r) => r.qty.toLocaleString(),
      sortValue: (r) => r.qty,
      className: "text-right",
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (r) => formatNPR(r.revenue),
      sortValue: (r) => r.revenue,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="SKUs Reported" value={rows.length} icon={Package} />
        <StatCard
          title="Revenue"
          value={formatNPR(
            rows.reduce((s, r) => s + r.revenue, 0),
            true
          )}
          icon={Receipt}
        />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.brand]}
        searchPlaceholder="Search products..."
        exportFilename="sales-by-product"
      />
    </div>
  );
}

export function SalespersonPerformanceReport() {
  const team = useTenantFiltered(SALES_TEAM);
  const avg =
    team.length > 0
      ? Math.round(team.reduce((s, r) => s + r.achieved, 0) / team.length)
      : 0;

  const columns: Column<(typeof team)[0]>[] = [
    {
      key: "name",
      header: "Salesperson",
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    { key: "route", header: "Route", cell: (r) => r.route },
    {
      key: "visits",
      header: "Visits",
      cell: (r) => r.visits,
      sortValue: (r) => r.visits,
      className: "text-right",
    },
    {
      key: "orders",
      header: "Orders",
      cell: (r) => r.orders,
      sortValue: (r) => r.orders,
      className: "text-right",
    },
    {
      key: "collections",
      header: "Collections",
      cell: (r) => formatNPR(r.collections),
      sortValue: (r) => r.collections,
      className: "text-right",
    },
    {
      key: "target",
      header: "Target",
      cell: (r) => formatNPR(r.target),
      sortValue: (r) => r.target,
      className: "text-right",
    },
    {
      key: "achieved",
      header: "Achieved",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.achieved} className="h-1.5 w-16" />
          <span className="text-sm">{r.achieved}%</span>
        </div>
      ),
      sortValue: (r) => r.achieved,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Active Reps" value={team.length} icon={Users} />
        <StatCard
          title="Collections"
          value={formatNPR(
            team.reduce((s, r) => s + r.collections, 0),
            true
          )}
          icon={Banknote}
        />
        <StatCard title="Avg Target Hit" value={`${avg}%`} icon={Target} />
      </div>
      <DataTable
        data={team}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.route]}
        searchPlaceholder="Search reps..."
        exportFilename="salesperson-performance"
      />
    </div>
  );
}

export function CollectionReport() {
  const invoices = useTenantInvoices();

  const byMethod = useMemo(() => {
    const map = new Map<
      string,
      { method: string; count: number; billed: number; collected: number; due: number }
    >();
    for (const inv of invoices) {
      const method = inv.method.replace(/_/g, " ");
      const row = map.get(method) ?? {
        method,
        count: 0,
        billed: 0,
        collected: 0,
        due: 0,
      };
      row.count += 1;
      row.billed += inv.total;
      row.collected += inv.total - inv.due;
      row.due += inv.due;
      map.set(method, row);
    }
    return [...map.values()].sort((a, b) => b.collected - a.collected);
  }, [invoices]);

  const trendHint = SALES_TREND[SALES_TREND.length - 1];

  const columns: Column<(typeof byMethod)[0]>[] = [
    {
      key: "method",
      header: "Method",
      cell: (r) => <span className="font-medium">{r.method}</span>,
      sortValue: (r) => r.method,
    },
    {
      key: "count",
      header: "Invoices",
      cell: (r) => r.count,
      sortValue: (r) => r.count,
      className: "text-right",
    },
    {
      key: "billed",
      header: "Billed",
      cell: (r) => formatNPR(r.billed),
      sortValue: (r) => r.billed,
      className: "text-right",
    },
    {
      key: "collected",
      header: "Collected",
      cell: (r) => formatNPR(r.collected),
      sortValue: (r) => r.collected,
      className: "text-right",
    },
    {
      key: "due",
      header: "Still Due",
      cell: (r) =>
        r.due > 0 ? (
          <span className="text-warning">{formatNPR(r.due)}</span>
        ) : (
          "—"
        ),
      sortValue: (r) => r.due,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Collected (period)"
          value={formatNPR(
            byMethod.reduce((s, r) => s + r.collected, 0),
            true
          )}
          icon={Banknote}
        />
        <StatCard
          title="Still Due"
          value={formatNPR(
            byMethod.reduce((s, r) => s + r.due, 0),
            true
          )}
          icon={Wallet}
        />
        <StatCard
          title="Today's Gap"
          value={formatNPR(trendHint.sales - trendHint.collection, true)}
          subtitle={`${trendHint.date}: sales vs collection`}
        />
      </div>
      <DataTable
        data={byMethod}
        columns={columns}
        getRowId={(r) => r.method}
        exportFilename="collection-report"
      />
    </div>
  );
}

export function OutstandingAgingReport() {
  const customers = useTenantCustomers();
  const rows = useMemo(
    () =>
      customers
        .filter((c) => c.outstanding > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          area: c.area,
          outstanding: c.outstanding,
          creditLimit: c.creditLimit,
          lastOrder: c.lastOrder,
          bucket: agingBucket(c.lastOrder, c.outstanding),
          utilization: Math.round((c.outstanding / c.creditLimit) * 100),
        }))
        .sort((a, b) => b.outstanding - a.outstanding),
    [customers]
  );

  const buckets = useMemo(() => {
    const order = ["0–7 days", "8–30 days", "31–60 days", "60+ days"];
    return order.map((label) => ({
      label,
      amount: rows
        .filter((r) => r.bucket === label)
        .reduce((s, r) => s + r.outstanding, 0),
      count: rows.filter((r) => r.bucket === label).length,
    }));
  }, [rows]);

  const columns: Column<(typeof rows)[0]>[] = [
    {
      key: "name",
      header: "Customer",
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    { key: "area", header: "Area", cell: (r) => r.area },
    {
      key: "bucket",
      header: "Age",
      cell: (r) => <Badge variant="muted">{r.bucket}</Badge>,
      sortValue: (r) => r.bucket,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      cell: (r) => <span className="text-warning">{formatNPR(r.outstanding)}</span>,
      sortValue: (r) => r.outstanding,
      className: "text-right",
    },
    {
      key: "utilization",
      header: "Credit Used",
      cell: (r) => `${r.utilization}%`,
      sortValue: (r) => r.utilization,
      className: "text-right",
    },
    {
      key: "lastOrder",
      header: "Last Order",
      cell: (r) => formatDate(r.lastOrder),
      sortValue: (r) => r.lastOrder,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((b) => (
          <StatCard
            key={b.label}
            title={b.label}
            value={formatNPR(b.amount, true)}
            subtitle={`${b.count} account${b.count === 1 ? "" : "s"}`}
          />
        ))}
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.area, (r) => r.bucket]}
        searchPlaceholder="Search receivables..."
        exportFilename="outstanding-aging"
      />
    </div>
  );
}

export function ProfitLossReport() {
  const invoices = useTenantInvoices();
  const expenses = useTenantExpenses();
  const vatEnabled = useVatEnabled();

  const revenue = invoices.reduce((s, i) => s + i.subtotal, 0);
  const vat = invoices.reduce((s, i) => s + i.vat, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const cogsEstimate = Math.round(revenue * (1 - DASHBOARD_KPIS.profitMargin / 100));
  const grossProfit = revenue - cogsEstimate;
  const netProfit = grossProfit - expenseTotal;
  const latest = CASH_FLOW[CASH_FLOW.length - 1];

  const lines = [
    { id: "rev", label: vatEnabled ? "Net Sales (ex-VAT)" : "Net Sales", amount: revenue },
    { id: "cogs", label: "Estimated COGS", amount: -cogsEstimate },
    { id: "gp", label: "Gross Profit", amount: grossProfit },
    { id: "exp", label: "Operating Expenses", amount: -expenseTotal },
    { id: "net", label: "Net Profit", amount: netProfit },
    ...(vatEnabled
      ? [{ id: "vat", label: "VAT Collected (memo)", amount: vat }]
      : []),
  ];

  const columns: Column<(typeof lines)[0]>[] = [
    {
      key: "label",
      header: "Line",
      cell: (r) => (
        <span className={r.id === "net" || r.id === "gp" ? "font-semibold" : ""}>
          {r.label}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => (
        <span className={r.amount < 0 ? "text-danger" : ""}>
          {formatNPR(r.amount)}
        </span>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Net Sales" value={formatNPR(revenue, true)} icon={Receipt} />
        <StatCard title="Gross Profit" value={formatNPR(grossProfit, true)} />
        <StatCard title="Expenses" value={formatNPR(expenseTotal, true)} />
        <StatCard
          title="Net Profit"
          value={formatNPR(netProfit, true)}
          subtitle={`Margin ~${formatPercent(DASHBOARD_KPIS.profitMargin)}`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Cash flow snapshot — {latest.month}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground">Inflow</p>
            <p className="font-semibold">{formatNPR(latest.inflow)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Outflow</p>
            <p className="font-semibold">{formatNPR(latest.outflow)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Net</p>
            <p className="font-semibold">
              {formatNPR(latest.inflow - latest.outflow)}
            </p>
          </div>
        </CardContent>
      </Card>
      <DataTable
        data={lines}
        columns={columns}
        getRowId={(r) => r.id}
        exportFilename="profit-loss"
        pageSize={20}
      />
    </div>
  );
}

export function VatReport() {
  const invoices = useTenantInvoices();
  const rows = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((inv) => ({
          id: inv.id,
          number: inv.number,
          date: inv.date,
          customer: inv.customer,
          subtotal: inv.subtotal,
          vat: inv.vat,
          total: inv.total,
          rate: VAT_RATE * 100,
        })),
    [invoices]
  );

  const vatTotal = rows.reduce((s, r) => s + r.vat, 0);
  const taxable = rows.reduce((s, r) => s + r.subtotal, 0);

  const columns: Column<(typeof rows)[0]>[] = [
    {
      key: "number",
      header: "Invoice",
      cell: (r) => <span className="font-medium text-primary">{r.number}</span>,
      sortValue: (r) => r.number,
    },
    {
      key: "date",
      header: "Date",
      cell: (r) => formatDate(r.date),
      sortValue: (r) => r.date,
    },
    { key: "customer", header: "Customer", cell: (r) => r.customer },
    {
      key: "subtotal",
      header: "Taxable",
      cell: (r) => formatNPR(r.subtotal),
      sortValue: (r) => r.subtotal,
      className: "text-right",
    },
    {
      key: "vat",
      header: "VAT 13%",
      cell: (r) => formatNPR(r.vat),
      sortValue: (r) => r.vat,
      className: "text-right",
    },
    {
      key: "total",
      header: "Gross",
      cell: (r) => formatNPR(r.total),
      sortValue: (r) => r.total,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Taxable Sales" value={formatNPR(taxable, true)} />
        <StatCard title="VAT Output" value={formatNPR(vatTotal, true)} icon={Receipt} />
        <StatCard title="Invoices" value={rows.length} />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.number, (r) => r.customer]}
        searchPlaceholder="Search invoices..."
        exportFilename="vat-report"
      />
    </div>
  );
}

export function StockMovementReport() {
  const products = useTenantProducts();
  const tenant = useCurrentTenant();
  const warehouse =
    tenant?.id === "t2" ? "Beauty Store — Lakeside" : "Main Store — Teku";

  const rows = useMemo(
    () =>
      products.map((p) => {
        const inbound = Math.max(0, Math.round(p.reorderAt * 1.5));
        const outbound = Math.max(0, Math.round(p.stock * 0.12));
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          warehouse,
          opening: Math.max(0, p.stock + outbound - inbound),
          inbound,
          outbound,
          closing: p.stock,
          value: p.stock * p.tradePrice,
        };
      }),
    [products, warehouse]
  );

  const columns: Column<(typeof rows)[0]>[] = [
    {
      key: "sku",
      header: "SKU",
      cell: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    {
      key: "name",
      header: "Product",
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    { key: "warehouse", header: "Warehouse", cell: (r) => r.warehouse },
    {
      key: "opening",
      header: "Opening",
      cell: (r) => r.opening,
      sortValue: (r) => r.opening,
      className: "text-right",
    },
    {
      key: "inbound",
      header: "In",
      cell: (r) => <span className="text-success">+{r.inbound}</span>,
      sortValue: (r) => r.inbound,
      className: "text-right",
    },
    {
      key: "outbound",
      header: "Out",
      cell: (r) => <span className="text-danger">−{r.outbound}</span>,
      sortValue: (r) => r.outbound,
      className: "text-right",
    },
    {
      key: "closing",
      header: "Closing",
      cell: (r) => r.closing,
      sortValue: (r) => r.closing,
      className: "text-right",
    },
    {
      key: "value",
      header: "Value",
      cell: (r) => formatNPR(r.value),
      sortValue: (r) => r.value,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="SKUs" value={rows.length} icon={Boxes} />
        <StatCard
          title="Inbound Units"
          value={rows.reduce((s, r) => s + r.inbound, 0).toLocaleString()}
        />
        <StatCard
          title="Outbound Units"
          value={rows.reduce((s, r) => s + r.outbound, 0).toLocaleString()}
        />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.sku, (r) => r.name]}
        searchPlaceholder="Search stock..."
        exportFilename="stock-movement"
      />
    </div>
  );
}

export function LowStockReport() {
  const products = useTenantProducts();
  const rows = useMemo(
    () =>
      products
        .map((p) => {
          const status =
            p.stock <= p.reorderAt
              ? p.stock < p.reorderAt * 0.3
                ? "critical"
                : "low"
              : "ok";
          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            stock: p.stock,
            reorderAt: p.reorderAt,
            deficit: Math.max(0, p.reorderAt - p.stock),
            status,
            value: p.stock * p.tradePrice,
          };
        })
        .filter((r) => r.status !== "ok")
        .sort((a, b) => a.stock / a.reorderAt - b.stock / b.reorderAt),
    [products]
  );

  const critical = rows.filter((r) => r.status === "critical").length;

  const columns: Column<(typeof rows)[0]>[] = [
    {
      key: "sku",
      header: "SKU",
      cell: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    {
      key: "name",
      header: "Product",
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    {
      key: "stock",
      header: "On Hand",
      cell: (r) => r.stock,
      sortValue: (r) => r.stock,
      className: "text-right",
    },
    {
      key: "reorderAt",
      header: "Reorder At",
      cell: (r) => r.reorderAt,
      sortValue: (r) => r.reorderAt,
      className: "text-right",
    },
    {
      key: "deficit",
      header: "Shortfall",
      cell: (r) => r.deficit,
      sortValue: (r) => r.deficit,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Below Reorder" value={rows.length} icon={AlertTriangle} />
        <StatCard title="Critical" value={critical} />
        <StatCard
          title="Units Short"
          value={rows.reduce((s, r) => s + r.deficit, 0).toLocaleString()}
        />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.sku, (r) => r.name]}
        searchPlaceholder="Search low stock..."
        exportFilename="low-stock"
      />
    </div>
  );
}

export function DeliverySummaryReport() {
  const deliveries = useTenantFiltered(DELIVERIES);

  const summary = useMemo(() => {
    const statuses = ["DELIVERED", "OUT_FOR_DELIVERY", "SCHEDULED", "FAILED"] as const;
    return statuses.map((status) => ({
      status,
      count: deliveries.filter((d) => d.status === status).length,
      items: deliveries
        .filter((d) => d.status === status)
        .reduce((s, d) => s + d.items, 0),
    }));
  }, [deliveries]);

  const columns: Column<(typeof deliveries)[0]>[] = [
    {
      key: "number",
      header: "Delivery",
      cell: (r) => <span className="font-medium">{r.number}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      cell: (r) => r.customer,
      sortValue: (r) => r.customer,
    },
    { key: "driver", header: "Driver", cell: (r) => r.driver },
    {
      key: "items",
      header: "Items",
      cell: (r) => r.items,
      className: "text-right",
    },
    { key: "eta", header: "ETA", cell: (r) => r.eta },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => (
          <StatCard
            key={s.status}
            title={s.status.replace(/_/g, " ")}
            value={s.count}
            subtitle={`${s.items} items`}
            icon={Truck}
          />
        ))}
      </div>
      <DataTable
        data={deliveries}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.number, (r) => r.customer, (r) => r.driver]}
        searchPlaceholder="Search deliveries..."
        exportFilename="delivery-summary"
      />
    </div>
  );
}

export function PurchaseAnalysisReport() {
  const pos = useTenantPurchaseOrders();

  const rows = useMemo(
    () =>
      pos.map((po) => {
        const receivedPct =
          po.status === "RECEIVED"
            ? 100
            : po.status === "PARTIALLY_RECEIVED"
              ? 55
              : po.status === "ORDERED"
                ? 0
                : 0;
        const receivedValue = Math.round((po.total * receivedPct) / 100);
        return {
          id: po.id,
          number: po.number,
          supplier: po.supplier,
          date: po.date,
          status: po.status,
          ordered: po.total,
          received: receivedValue,
          variance: po.total - receivedValue,
          receivedPct,
        };
      }),
    [pos]
  );

  const columns: Column<(typeof rows)[0]>[] = [
    {
      key: "number",
      header: "PO",
      cell: (r) => <span className="font-medium text-primary">{r.number}</span>,
      sortValue: (r) => r.number,
    },
    { key: "supplier", header: "Supplier", cell: (r) => r.supplier },
    {
      key: "date",
      header: "Date",
      cell: (r) => formatDate(r.date),
      sortValue: (r) => r.date,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "ordered",
      header: "Ordered",
      cell: (r) => formatNPR(r.ordered),
      sortValue: (r) => r.ordered,
      className: "text-right",
    },
    {
      key: "received",
      header: "Received (GRN)",
      cell: (r) => formatNPR(r.received),
      sortValue: (r) => r.received,
      className: "text-right",
    },
    {
      key: "variance",
      header: "Open Variance",
      cell: (r) =>
        r.variance > 0 ? (
          <span className="text-warning">{formatNPR(r.variance)}</span>
        ) : (
          "—"
        ),
      sortValue: (r) => r.variance,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Purchase Orders" value={rows.length} icon={Package} />
        <StatCard
          title="Ordered Value"
          value={formatNPR(
            rows.reduce((s, r) => s + r.ordered, 0),
            true
          )}
        />
        <StatCard
          title="Open Variance"
          value={formatNPR(
            rows.reduce((s, r) => s + r.variance, 0),
            true
          )}
        />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.number, (r) => r.supplier]}
        searchPlaceholder="Search purchase orders..."
        exportFilename="purchase-analysis"
      />
    </div>
  );
}
