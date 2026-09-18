"use client";

import Link from "next/link";
import {
  Boxes,
  Package,
  Settings,
  Shield,
  Truck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import {
  useCanAccessAdmin,
  useCanManageTenantUsers,
  useCurrentTenant,
  useVatEnabled,
} from "@/lib/use-entitlements";
import { VAT_RATE } from "@/lib/format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const router = useRouter();
  const canAdmin = useCanAccessAdmin();
  const canUsers = useCanManageTenantUsers();
  const tenant = useCurrentTenant();
  const vatEnabled = useVatEnabled();
  const updateTenant = useAppStore((s) => s.updateTenant);
  const users = useAppStore((s) => s.users).filter(
    (u) => u.tenantId === tenant?.id && u.active !== false,
  );

  useEffect(() => {
    if (!canAdmin) router.replace("/dashboard");
  }, [canAdmin, router]);

  if (!canAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">Admin access required…</p>;
  }

  const setVat = (on: boolean) => {
    if (!tenant) return;
    try {
      updateTenant(tenant.id, { vatEnabled: on });
      toast.success(on ? "VAT enabled — mark products that need VAT" : "VAT off for store");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update VAT");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Glamo Nepal store settings — VAT, staff, and operations"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> VAT
            </CardTitle>
            <CardDescription>
              Not every product needs VAT. Turn store VAT on only when required, then tick
              “VAT applies” on those SKUs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-border p-3">
              <Checkbox
                checked={vatEnabled}
                onChange={(e) => setVat(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <Label className="text-sm font-medium">Enable VAT for this store</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  When off, POS and bills show selling price only (no {(VAT_RATE * 100).toFixed(0)}%
                  add-on). When on, VAT is charged only on products marked VAT-applicable.
                </p>
              </div>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={vatEnabled ? "success" : "muted"}>
                {vatEnabled ? "VAT on" : "VAT off"}
              </Badge>
              <Link href="/products">
                <Button size="sm" variant="outline">
                  Mark products
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Staff
            </CardTitle>
            <CardDescription>
              {users.length} active user(s) · {canUsers ? "you can manage from Settings" : "owner only"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-1 text-sm">
              {users.slice(0, 6).map((u) => (
                <li key={u.id} className="flex justify-between gap-2">
                  <span className="truncate">{u.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{u.role}</span>
                </li>
              ))}
            </ul>
            <Link href="/settings">
              <Button size="sm" variant="outline" className="mt-2">
                <Settings className="h-3.5 w-3.5" /> Open settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
          <CardDescription>Day-to-day store operations</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/products">
            <Button variant="outline">
              <Package className="h-4 w-4" /> Products
            </Button>
          </Link>
          <Link href="/inventory">
            <Button variant="outline">
              <Boxes className="h-4 w-4" /> Inventory
            </Button>
          </Link>
          <Link href="/inventory/barcodes">
            <Button variant="outline">Barcodes</Button>
          </Link>
          <Link href="/delivery">
            <Button variant="outline">
              <Truck className="h-4 w-4" /> Delivery
            </Button>
          </Link>
          <Link href="/customers">
            <Button variant="outline">
              <Users className="h-4 w-4" /> Customers
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline">
              <Settings className="h-4 w-4" /> Settings
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
