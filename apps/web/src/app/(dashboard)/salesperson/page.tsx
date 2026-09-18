"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle, MapPin, Navigation, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SALES_TEAM } from "@/lib/mock-data";
import { useTenantCustomers } from "@/lib/use-tenant-data";
import { useTenantFiltered } from "@/lib/use-tenant-data";
import { useAuth } from "@/components/providers/auth-provider";
import { formatNPR } from "@/lib/format";

export default function SalespersonPage() {
  const { user } = useAuth();
  const customers = useTenantCustomers();
  const team = useTenantFiltered(SALES_TEAM);
  const rep =
    team.find((r) => r.name === user?.name) ??
    team[0] ?? {
      id: "st0",
      name: user?.name ?? "Field rep",
      route: "Assigned route",
      visits: 0,
      orders: 0,
      collections: 0,
      target: 0,
      achieved: 0,
      tenantId: "",
    };

  const routeStops = useMemo(() => {
    const picks = customers.slice(0, 4);
    return picks.map((customer, i) => ({
      id: String(i + 1),
      customer,
      status: i === 0 ? "completed" : i === 1 ? "current" : "pending",
      order: i === 0 ? 12500 : i === 2 ? 8800 : 0,
    }));
  }, [customers]);

  const completed = routeStops.filter((s) => s.status === "completed").length;
  const progress = routeStops.length ? (completed / routeStops.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field App"
        description={`${rep.name} · ${rep.route} route`}
        actions={
          <Badge variant="success" className="gap-1">
            <Navigation className="h-3 w-3" /> On route
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Visits today</p>
            <p className="text-2xl font-semibold">
              {completed}/{routeStops.length || "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Collections</p>
            <p className="text-2xl font-semibold">{formatNPR(rep.collections, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Target</p>
            <Progress value={rep.achieved} className="mt-2 h-2" />
            <p className="mt-1 text-sm font-medium">{rep.achieved}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s route</CardTitle>
          <Progress value={progress} className="h-1.5" />
        </CardHeader>
        <CardContent className="space-y-3">
          {routeStops.length === 0 && (
            <p className="text-sm text-muted-foreground">No customers on this route yet.</p>
          )}
          {routeStops.map((stop) => (
            <div
              key={stop.id}
              className="flex items-center gap-3 rounded-xl border border-border p-3"
            >
              {stop.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : stop.status === "current" ? (
                <MapPin className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{stop.customer.name}</p>
                <p className="text-xs text-muted-foreground">{stop.customer.area}</p>
              </div>
              <div className="text-right">
                {stop.order > 0 ? (
                  <p className="text-sm font-medium">{formatNPR(stop.order)}</p>
                ) : (
                  <Button size="sm" variant="outline">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
