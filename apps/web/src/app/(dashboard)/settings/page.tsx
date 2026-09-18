"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreateBranchDialog, InviteUserDialog } from "@/components/forms/create-dialogs";
import { COMPANY } from "@/lib/mock-data";
import { roleDisplayLabel, userCanDeleteRecords, userCanEditRecords } from "@/lib/features";
import { useAppStore } from "@/lib/store";
import { useCanManageTenantUsers, useCurrentTenant, useVatEnabled } from "@/lib/use-entitlements";
import { useTenantBranches } from "@/lib/use-tenant-data";
import { VAT_RATE } from "@/lib/format";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export default function SettingsPage() {
  const allUsers = useAppStore((s) => s.users);
  const updateUser = useAppStore((s) => s.updateUser);
  const updateTenant = useAppStore((s) => s.updateTenant);
  const branches = useTenantBranches();
  const tenant = useCurrentTenant();
  const vatEnabled = useVatEnabled();
  const canManageUsers = useCanManageTenantUsers();
  const users = allUsers.filter(
    (u) => u.tenantId === tenant?.id && u.active !== false
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [company, setCompany] = useState({
    name: tenant?.name ?? COMPANY.name,
    shortName: tenant?.shortName ?? COMPANY.shortName,
    vat: COMPANY.vat,
    phone: COMPANY.phone,
    address: COMPANY.address,
    email: COMPANY.email,
  });
  const [vatForm, setVatForm] = useState({
    registration: COMPANY.vat,
    invoicePrefix: "INV-",
  });

  useEffect(() => {
    if (!tenant) return;
    setCompany((c) => ({
      ...c,
      name: tenant.name,
      shortName: tenant.shortName,
    }));
  }, [tenant]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={
          vatEnabled
            ? "Company profile, VAT, users, and branches"
            : "Company profile, users, and branches"
        }
      />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          {vatEnabled && <TabsTrigger value="vat">VAT</TabsTrigger>}
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Profile</CardTitle>
              <CardDescription>Legal and contact information</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={company.name} onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Short Name</Label>
                <Input value={company.shortName} onChange={(e) => setCompany((c) => ({ ...c, shortName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{vatEnabled ? "PAN / VAT Number" : "PAN Number"}</Label>
                <Input value={company.vat} onChange={(e) => setCompany((c) => ({ ...c, vat: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={company.phone} onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={company.address} onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={company.email} onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={() => {
                    if (!company.name.trim() || !company.vat.trim()) {
                      toast.error(
                        vatEnabled
                          ? "Company name and VAT number are required"
                          : "Company name and PAN number are required"
                      );
                      return;
                    }
                    if (tenant) {
                      try {
                        updateTenant(tenant.id, {
                          name: company.name.trim(),
                          shortName: company.shortName.trim() || company.name.trim(),
                        });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not save company");
                        return;
                      }
                    }
                    toast.success("Company profile saved");
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {vatEnabled && (
        <TabsContent value="vat">
          <Card>
            <CardHeader>
              <CardTitle>VAT Configuration</CardTitle>
              <CardDescription>Nepal IRD compliance settings</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Standard VAT Rate</Label>
                <Input defaultValue={`${(VAT_RATE * 100).toFixed(0)}%`} readOnly />
              </div>
              <div className="space-y-2">
                <Label>VAT Registration</Label>
                <Input
                  value={vatForm.registration}
                  onChange={(e) => setVatForm((v) => ({ ...v, registration: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Invoice Prefix</Label>
                <Input
                  value={vatForm.invoicePrefix}
                  onChange={(e) => setVatForm((v) => ({ ...v, invoicePrefix: e.target.value }))}
                />
              </div>
              <div className="rounded-xl bg-muted/50 p-4 sm:col-span-2 text-sm">
                <p className="font-medium">Fiscal year</p>
                <p className="text-muted-foreground">Shrawan 2082 – Ashadh 2083 (Nepali BS)</p>
              </div>
              <Button
                onClick={() => {
                  if (!vatForm.registration.trim()) {
                    toast.error("VAT registration number is required");
                    return;
                  }
                  toast.success("VAT settings updated");
                }}
              >
                Update VAT Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  {users.length} active users
                  {canManageUsers
                    ? " — create staff with email and password"
                    : " — ask your owner to add users"}
                </CardDescription>
              </div>
              {canManageUsers && (
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  Create User
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((u) => {
                  const privileged =
                    u.role === "OWNER" || u.role === "ADMIN" || u.role === "PLATFORM_ADMIN";
                  return (
                    <div
                      key={u.id}
                      className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                          {u.avatar}
                        </div>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="muted">{roleDisplayLabel(u.role)}</Badge>
                        <Badge variant="success">{u.status}</Badge>
                        {canManageUsers && (
                          <div className="flex flex-wrap gap-3 text-xs">
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={userCanEditRecords(u)}
                                disabled={privileged}
                                onChange={(e) => {
                                  updateUser(u.id, { canEdit: e.target.checked });
                                  toast.success(
                                    e.target.checked
                                      ? `Edit enabled for ${u.name}`
                                      : `Edit disabled for ${u.name}`
                                  );
                                }}
                              />
                              Edit
                            </label>
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={userCanDeleteRecords(u)}
                                disabled={privileged}
                                onChange={(e) => {
                                  updateUser(u.id, { canDelete: e.target.checked });
                                  toast.success(
                                    e.target.checked
                                      ? `Delete enabled for ${u.name}`
                                      : `Delete disabled for ${u.name}`
                                  );
                                }}
                              />
                              Delete
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Branches</CardTitle>
                <CardDescription>Multi-location operations</CardDescription>
              </div>
              <Button size="sm" onClick={() => setBranchOpen(true)}>
                Add Branch
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {branches.map((b) => (
                  <div key={b.code} className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Code: {b.code} · PAN: {b.pan}
                      </p>
                    </div>
                    <Badge variant={b.active ? "success" : "muted"}>
                      {b.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        tenantId={tenant?.id}
      />
      <CreateBranchDialog open={branchOpen} onOpenChange={setBranchOpen} />
    </div>
  );
}
