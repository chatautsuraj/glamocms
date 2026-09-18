"use client";

import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SALES_TEAM } from "@/lib/mock-data";
import { useTenantFiltered } from "@/lib/use-tenant-data";
import { formatNPR } from "@/lib/format";
import { Target, UserCheck } from "lucide-react";

type Rep = (typeof SALES_TEAM)[0];

const columns: Column<Rep>[] = [
  { key: "name", header: "Salesperson", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
  { key: "route", header: "Route", cell: (r) => r.route },
  { key: "visits", header: "Visits", cell: (r) => r.visits, sortValue: (r) => r.visits, className: "text-right" },
  { key: "orders", header: "Orders", cell: (r) => r.orders, sortValue: (r) => r.orders, className: "text-right" },
  { key: "collections", header: "Collections", cell: (r) => formatNPR(r.collections, true), sortValue: (r) => r.collections, className: "text-right" },
  {
    key: "target",
    header: "Target %",
    cell: (r) => (
      <div className="flex items-center gap-2">
        <Progress value={r.achieved} className="h-1.5 w-16" />
        <span className="text-sm">{r.achieved}%</span>
      </div>
    ),
    sortValue: (r) => r.achieved,
  },
];

export default function SalesTeamPage() {
  const team = useTenantFiltered(SALES_TEAM);
  const totalCollections = team.reduce((s, r) => s + r.collections, 0);
  const avgAchievement = team.length
    ? Math.round(team.reduce((s, r) => s + r.achieved, 0) / team.length)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Team"
        description="Field reps, routes, and target achievement"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Active Reps" value={team.length} icon={UserCheck} />
        <StatCard title="Today's Collections" value={formatNPR(totalCollections, true)} icon={Target} />
        <StatCard title="Avg Target Hit" value={`${avgAchievement}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {team.map((rep) => (
          <Card key={rep.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {rep.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1">
                <p className="font-medium">{rep.name}</p>
                <p className="text-xs text-muted-foreground">{rep.route}</p>
                <Progress value={rep.achieved} className="mt-2 h-1.5" />
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{rep.achieved}%</p>
                <p className="text-xs text-muted-foreground">{formatNPR(rep.collections, true)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        data={team}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.route]}
        exportFilename="sales-team"
      />
    </div>
  );
}
