"use client";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WAREHOUSES } from "@/lib/mock-data";
import { useTenantFiltered } from "@/lib/use-tenant-data";
import { formatNPR } from "@/lib/format";
import { MapPin, Package, Warehouse } from "lucide-react";

export default function WarehousePage() {
  const warehouses = useTenantFiltered(WAREHOUSES);
  const totalValue = warehouses.reduce((s, w) => s + w.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Storage locations, utilization, and capacity"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Locations" value={warehouses.length} icon={Warehouse} />
        <StatCard title="Combined Value" value={formatNPR(totalValue, true)} icon={Package} />
        <StatCard title="Total Racks" value={warehouses.reduce((s, w) => s + w.racks, 0)} icon={MapPin} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {warehouses.map((wh) => (
          <Card key={wh.id}>
            <CardHeader>
              <CardTitle className="text-base">{wh.name}</CardTitle>
              <p className="text-xs font-mono text-muted-foreground">{wh.code}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">SKUs</p>
                  <p className="text-lg font-semibold">{wh.skus}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Racks</p>
                  <p className="text-lg font-semibold">{wh.racks}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Stock value</p>
                  <p className="text-lg font-semibold">{formatNPR(wh.value, true)}</p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Utilization</span>
                  <span className="font-medium">{wh.utilization}%</span>
                </div>
                <Progress value={wh.utilization} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
