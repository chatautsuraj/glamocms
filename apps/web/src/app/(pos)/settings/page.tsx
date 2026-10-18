"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { settingsApi } from "@/lib/api/settings";
import { staffApi } from "@/lib/api/staff";
import type { PosSettings, PosSettingsPatch, Role } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { toastError } from "@/lib/notify";
import { useSettingsStore } from "@/lib/settings-store";
import { useApi } from "@/lib/use-api";

export default function SettingsPage() {
  const perms = useAuthStore((s) => s.permissions);
  const canRead = perms.includes("settings.read");
  const canWrite = perms.includes("settings.write");
  const canStaff = perms.includes("staff.manage");
  const { data, error, loading, reload, setData } = useApi(() => settingsApi.get(), [], { enabled: canRead });
  const [tab, setTab] = useState(canRead ? "store" : "staff");

  const save = async (patch: PosSettingsPatch) => {
    try {
      const next = await settingsApi.update(patch);
      setData(next);
      useSettingsStore.getState().set(next);
      useAuthStore.getState().setStore(next.store);
      toast.success("Settings saved");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description={canWrite ? "Changes save to the GLAMO API and apply to every till." : "Read-only — only a super admin can change settings."} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canRead && <TabsTrigger value="store">Store profile</TabsTrigger>}
          {canRead && <TabsTrigger value="pos">POS & receipts</TabsTrigger>}
          {canRead && <TabsTrigger value="delivery">Delivery</TabsTrigger>}
          {canRead && <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>}
          {canStaff && <TabsTrigger value="staff">Staff & roles</TabsTrigger>}
        </TabsList>
        {canRead && (error ? <div className="mt-4"><ErrorPanel error={error} onRetry={reload} /></div> : loading || !data ? (tab !== "staff" ? <div className="mt-4"><LoadingRows /></div> : null) : (
          <>
            <TabsContent value="store"><StoreForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="pos"><PosForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="delivery"><DeliveryForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="whatsapp"><WhatsAppForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
          </>
        ))}
        {canStaff && <TabsContent value="staff"><StaffPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}

function FormCard({ title, children, onSubmit, disabled, busy }: { title: string; children: ReactNode; onSubmit: () => Promise<void>; disabled: boolean; busy: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSubmit(); }}>
          <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">{children}</fieldset>
          {!disabled && <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>}
        </form>
      </CardContent>
    </Card>
  );
}

function useSaver(onSave: (p: PosSettingsPatch) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  return { busy, run: async (p: PosSettingsPatch) => { setBusy(true); try { await onSave(p); } finally { setBusy(false); } } };
}

type FormProps = { s: PosSettings; disabled: boolean; onSave: (p: PosSettingsPatch) => Promise<void> };

function StoreForm({ s, disabled, onSave }: FormProps) {
  const [f, setF] = useState(s.store);
  useEffect(() => setF(s.store), [s.store]);
  const { busy, run } = useSaver(onSave);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <FormCard title="Store profile (printed on bills & delivery notes)" disabled={disabled} busy={busy} onSubmit={() => run({ store: f })}>
      <Field label="Store name"><Input value={f.name} onChange={set("name")} required /></Field>
      <Field label="Legal name"><Input value={f.legalName} onChange={set("legalName")} /></Field>
      <Field label="Address" className="sm:col-span-2" hint="Also shown on glamonepal.com contact info"><Input value={f.address} onChange={set("address")} /></Field>
      <Field label="Phone"><Input value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
      <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
      <Field label="PAN"><Input value={f.pan} onChange={set("pan")} /></Field>
      <Field label="VAT number"><Input value={f.vatNumber} onChange={set("vatNumber")} /></Field>
      <Field label="Logo URL" className="sm:col-span-2" hint="Bills embed the bundled logo so they print offline."><Input type="url" value={f.logoUrl} onChange={set("logoUrl")} /></Field>
    </FormCard>
  );
}

function PosForm({ s, disabled, onSave }: FormProps) {
  const [f, setF] = useState(s.pos);
  useEffect(() => setF(s.pos), [s.pos]);
  const { busy, run } = useSaver(onSave);
  return (
    <FormCard title="POS" disabled={disabled} busy={busy} onSubmit={() => run({ pos: { ...f, billPrefix: f.billPrefix.toUpperCase() } })}>
      <Field label="VAT rate (%)" hint="Prices are VAT-inclusive; VAT is extracted per bill."><Input type="number" min={0} max={50} step="0.01" value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: Number(e.target.value) })} /></Field>
      <Field label="Bill number prefix" hint="2–8 capital letters/digits, e.g. GLM"><Input value={f.billPrefix} onChange={(e) => setF({ ...f, billPrefix: e.target.value.toUpperCase() })} pattern="[A-Z0-9]{2,8}" /></Field>
      <Field label="Max cashier discount (%)" hint="Above this a manager must apply the discount."><Input type="number" min={0} max={100} value={f.maxCashierDiscountPct} onChange={(e) => setF({ ...f, maxCashierDiscountPct: Number(e.target.value) })} /></Field>
      <div className="flex items-end"><CheckField label="Allow selling below zero stock" checked={f.allowNegativeStock} onChange={(v) => setF({ ...f, allowNegativeStock: v })} /></div>
      <Field label="Receipt footer" className="sm:col-span-2"><Textarea rows={2} value={f.receiptFooter} onChange={(e) => setF({ ...f, receiptFooter: e.target.value })} /></Field>
    </FormCard>
  );
}

function DeliveryForm({ s, disabled, onSave }: FormProps) {
  const [f, setF] = useState(s.delivery);
  useEffect(() => setF(s.delivery), [s.delivery]);
  const { busy, run } = useSaver(onSave);
  return (
    <FormCard title="Nepal Can Move" disabled={disabled} busy={busy} onSubmit={() => run({ delivery: f })}>
      <div className="sm:col-span-2"><CheckField label="Automatic NCM booking when an order is marked PACKED" hint="Needs the NCM API token on the server; manual “Send to NCM” always works." checked={f.ncmEnabled} onChange={(v) => setF({ ...f, ncmEnabled: v })} /></div>
      <Field label="Pickup branch"><Input value={f.ncmPickupBranch} onChange={(e) => setF({ ...f, ncmPickupBranch: e.target.value })} /></Field>
      <Field label="Default delivery type"><Input value={f.defaultDeliveryType} onChange={(e) => setF({ ...f, defaultDeliveryType: e.target.value })} /></Field>
      <Field label="Environment (informational)">
        <Select value={f.ncmEnv} onChange={(e) => setF({ ...f, ncmEnv: e.target.value as "dev" | "prod" })}><option value="prod">Production</option><option value="dev">Sandbox</option></Select>
      </Field>
    </FormCard>
  );
}

function WhatsAppForm({ s, disabled, onSave }: FormProps) {
  const [f, setF] = useState(s.whatsapp);
  useEffect(() => setF(s.whatsapp), [s.whatsapp]);
  const { busy, run } = useSaver(onSave);
  return (
    <FormCard title="WhatsApp" disabled={disabled} busy={busy} onSubmit={() => run({ whatsapp: f })}>
      <div className="sm:col-span-2 grid gap-x-6 sm:grid-cols-3">
        <CheckField label="WhatsApp enabled" hint="Order notifications & inbox replies" checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} />
        <CheckField label="Bot auto-replies" checked={f.autoReplyEnabled} onChange={(v) => setF({ ...f, autoReplyEnabled: v })} />
        <CheckField label="AI replies" hint="Also needs server env flags" checked={f.aiReplyEnabled} onChange={(v) => setF({ ...f, aiReplyEnabled: v })} />
      </div>
      <Field label="Number shown to customers"><Input value={f.phoneNumberDisplay} onChange={(e) => setF({ ...f, phoneNumberDisplay: e.target.value })} /></Field>
    </FormCard>
  );
}

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "CASHIER", label: "Cashier" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super admin" },
];

function StaffPanel() {
  const me = useAuthStore((s) => s.user);
  const { data, error, loading, reload, setData } = useApi(() => staffApi.list(), []);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("CASHIER");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await staffApi.create({ email: email.trim(), name: name.trim() || undefined, role });
      toast.success(`${email} can now sign in to GLAMO POS with Google`);
      setEmail("");
      setName("");
      void reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  const update = async (id: string, patch: { role?: string; isActive?: boolean }) => {
    try {
      const saved = await staffApi.update(id, patch);
      setData((data ?? []).map((s) => (s.id === id ? { ...s, ...saved } : s)));
      toast.success("Staff updated");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add staff</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <Field label="Google account email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Name (optional)"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>
            </Field>
            <Button type="submit" disabled={busy || !email.trim()}><UserPlus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
            <table className="w-full text-sm">
              <caption className="sr-only">Staff</caption>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border"><th scope="col" className="py-2 pr-3">Staff</th><th scope="col" className="py-2 pr-3">Role</th><th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {(data ?? []).map((s) => {
                  const self = s.id === me?.id;
                  const locked = self || s.role === "OWNER";
                  return (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="py-2 pr-3"><span className="block font-medium">{s.name}{self && " (you)"}</span><span className="text-xs text-muted-foreground">{s.email}</span></td>
                      <td className="py-2 pr-3">
                        {locked ? <span>{s.role}</span> : (
                          <Select aria-label={`Role for ${s.email}`} value={s.role === "STAFF" ? "CASHIER" : s.role} onChange={(e) => void update(s.id, { role: e.target.value })} className="w-40">
                            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </Select>
                        )}
                      </td>
                      <td className="py-2 pr-3"><Badge variant={s.isActive ? "success" : "muted"}>{s.isActive ? "Active" : "Inactive"}</Badge></td>
                      <td className="py-2 text-right">
                        {!locked && <Button size="sm" variant={s.isActive ? "outline" : "default"} onClick={() => void update(s.id, { isActive: !s.isActive })}>{s.isActive ? "Deactivate" : "Activate"}</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
