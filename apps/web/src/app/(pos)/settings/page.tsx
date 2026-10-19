"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2, Printer, UserPlus } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, SwitchField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { settingsApi } from "@/lib/api/settings";
import { staffApi } from "@/lib/api/staff";
import type { LabelSize, PaymentSettings, PosSettings, PosSettingsPatch, Role } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatTime } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { usePosConfig } from "@/lib/pos/config-store";
import { LABEL_SIZE_NAME, printLabels } from "@/lib/print/labels";
import { changedFields, isDirty, paymentErrors, paymentsPatch, posErrors, storeErrors, trimStrings, type FieldErrors } from "@/lib/settings-form";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const TAB_KEYS = ["store", "selling", "payments", "labels", "delivery", "whatsapp", "staff"] as const;

export default function SettingsPage() {
  const perms = useAuthStore((s) => s.permissions);
  const canRead = perms.includes("settings.read");
  const canWrite = perms.includes("settings.write");
  const canStaff = perms.includes("staff.manage");
  const { data, error, loading, reload, setData } = useApi(() => settingsApi.get(), [], { enabled: canRead });
  const [tab, setTab] = useState<string>(canRead ? "store" : "staff");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && (TAB_KEYS as readonly string[]).includes(t)) setTab(t);
  }, []);

  /** PATCH, then refresh everything that reads settings (POS config on this device, header store name). */
  const save = async (patch: PosSettingsPatch) => {
    const next = await settingsApi.update(patch);
    setData(next);
    useAuthStore.getState().setStore(next.store);
    await usePosConfig.getState().refresh();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description={canWrite ? "Changes apply to every counter straight away." : canRead ? "You can view the settings. Only the owner can change them." : undefined}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList label="Settings sections">
          {canRead && <TabsTrigger value="store">Shop details</TabsTrigger>}
          {canRead && <TabsTrigger value="selling">VAT &amp; bills</TabsTrigger>}
          {canRead && <TabsTrigger value="payments">Payments</TabsTrigger>}
          {canRead && <TabsTrigger value="labels">Barcode labels</TabsTrigger>}
          {canRead && <TabsTrigger value="delivery">Delivery</TabsTrigger>}
          {canRead && <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>}
          {canStaff && <TabsTrigger value="staff">Staff</TabsTrigger>}
        </TabsList>
        {canRead && tab !== "staff" && (error ? <div className="mt-4"><ErrorPanel error={error} onRetry={reload} /></div> : loading || !data ? <div className="mt-4"><LoadingRows rows={6} /></div> : (
          <>
            <TabsContent value="store" keepMounted><StoreForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="selling" keepMounted><SellingForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="payments" keepMounted><PaymentsForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="labels" keepMounted><LabelsForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="delivery" keepMounted><DeliveryForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
            <TabsContent value="whatsapp" keepMounted><WhatsAppForm s={data} disabled={!canWrite} onSave={save} /></TabsContent>
          </>
        ))}
        {canStaff && <TabsContent value="staff"><StaffPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}

type FormProps = { s: PosSettings; disabled: boolean; onSave: (p: PosSettingsPatch) => Promise<void> };

/** Draft state for one settings section + save status ("Unsaved changes" / "Saved at 2:15 pm"). */
function useSection<T extends object>(initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  useEffect(() => setDraft(initial), [initial]);
  const dirty = isDirty(initial, draft);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setSavedAt(new Date());
      toast.success("Saved");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value }));
  return { draft, setDraft, set, busy, dirty, savedAt, run };
}

function SectionCard({ title, description, children, onSubmit, disabled, busy, dirty, savedAt, errors, extra }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onSubmit: () => void;
  disabled: boolean;
  busy: boolean;
  dirty: boolean;
  savedAt: Date | null;
  errors?: FieldErrors;
  extra?: ReactNode;
}) {
  const hasErrors = Boolean(errors && Object.keys(errors).length);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (errors && Object.keys(errors).length) form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [errors]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form ref={form} className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <fieldset disabled={disabled} className="space-y-5">{children}</fieldset>
          {!disabled && (
            <div className="-mx-5 flex flex-wrap items-center gap-3 border-t border-border bg-card px-5 pb-[env(safe-area-inset-bottom)] pt-4">
              <Button type="submit" variant="brand" disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</Button>
              <span role="status" aria-live="polite" className={cn("text-sm", dirty ? "font-medium text-warning" : "text-muted-foreground")}>
                {hasErrors ? <span className="text-danger">Please fix the highlighted fields.</span> : dirty ? "Unsaved changes" : savedAt ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" aria-hidden /> Saved at {formatTime(savedAt)}</span> : "All changes saved"}
              </span>
              {extra}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function StoreForm({ s, disabled, onSave }: FormProps) {
  const sec = useSection(s.store);
  const [errors, setErrors] = useState<FieldErrors>({});
  const f = sec.draft;
  const text = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => sec.set(k, e.target.value);
  const submit = () => {
    const e = storeErrors(f);
    setErrors(e);
    if (Object.keys(e).length) return;
    void sec.run(() => onSave({ store: changedFields(s.store, trimStrings(f)) }));
  };
  return (
    <SectionCard title="Shop details" description="Printed on bills and delivery notes. Address and phone also show on glamonepal.com." onSubmit={submit} disabled={disabled} busy={sec.busy} dirty={sec.dirty} savedAt={sec.savedAt} errors={errors}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shop name *" error={errors.name}><Input value={f.name} onChange={text("name")} aria-invalid={Boolean(errors.name)} /></Field>
        <Field label="Registered (legal) name" hint="Printed under the shop name when different."><Input value={f.legalName} onChange={text("legalName")} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={text("address")} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={text("phone")} inputMode="tel" /></Field>
        <Field label="Email" error={errors.email}><Input type="email" value={f.email} onChange={text("email")} aria-invalid={Boolean(errors.email)} /></Field>
        <Field label="PAN" hint="9 digits. With VAT on, bills become tax invoices." error={errors.pan}><Input value={f.pan} onChange={(e) => sec.set("pan", e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" aria-invalid={Boolean(errors.pan)} /></Field>
        <Field label="VAT number" error={errors.vatNumber}><Input value={f.vatNumber} onChange={text("vatNumber")} aria-invalid={Boolean(errors.vatNumber)} /></Field>
      </div>
      <ImageUpload label="Logo" value={f.logoUrl} onChange={(v) => sec.set("logoUrl", v)} disabled={disabled} error={errors.logoUrl} square={false} />
    </SectionCard>
  );
}

function SellingForm({ s, disabled, onSave }: FormProps) {
  const sec = useSection(s.pos);
  const [errors, setErrors] = useState<FieldErrors>({});
  const f = sec.draft;
  const submit = () => {
    const e = posErrors(f);
    setErrors(e);
    if (Object.keys(e).length) return;
    void sec.run(() => onSave({ pos: changedFields(s.pos, f) }));
  };
  return (
    <SectionCard title="VAT & bills" onSubmit={submit} disabled={disabled} busy={sec.busy} dirty={sec.dirty} savedAt={sec.savedAt} errors={errors}>
      <div className="rounded-xl border border-border p-4">
        <SwitchField
          label="Charge VAT"
          hint={f.vatEnabled ? "Prices include VAT. Bills show the VAT amount." : "VAT is off: no VAT is calculated and bills show no VAT lines."}
          checked={f.vatEnabled}
          onChange={(v) => sec.set("vatEnabled", v)}
        />
        {f.vatEnabled && (
          <Field label="VAT rate (%)" className="mt-3 max-w-xs" error={errors.vatRate}>
            <Input type="number" min={0} max={50} step="0.01" value={Number.isFinite(f.vatRate) ? f.vatRate : ""} onChange={(e) => sec.set("vatRate", e.target.value === "" ? Number.NaN : Number(e.target.value))} aria-invalid={Boolean(errors.vatRate)} />
          </Field>
        )}
      </div>
      <Field label="Bill footer" hint="Printed at the bottom of every bill, e.g. exchange policy. Leave empty for none." error={errors.receiptFooter}>
        <Textarea rows={3} value={f.receiptFooter} onChange={(e) => sec.set("receiptFooter", e.target.value)} maxLength={500} aria-invalid={Boolean(errors.receiptFooter)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bill number prefix" hint="2 to 8 capital letters or numbers." error={errors.billPrefix}>
          <Input value={f.billPrefix} onChange={(e) => sec.set("billPrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} aria-invalid={Boolean(errors.billPrefix)} />
        </Field>
        <Field label="Cashier discount limit (%)" hint="Bigger discounts need a manager." error={errors.maxCashierDiscountPct}>
          <Input type="number" min={0} max={100} value={Number.isFinite(f.maxCashierDiscountPct) ? f.maxCashierDiscountPct : ""} onChange={(e) => sec.set("maxCashierDiscountPct", e.target.value === "" ? Number.NaN : Number(e.target.value))} aria-invalid={Boolean(errors.maxCashierDiscountPct)} />
        </Field>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border px-4">
        <SwitchField label="Allow selling when stock shows 0" hint="Useful if stock counts are not up to date." checked={f.allowNegativeStock} onChange={(v) => sec.set("allowNegativeStock", v)} />
        <SwitchField label="Ask for the customer's phone on every counter sale" hint="Off: counter sales are walk-in unless the cashier adds a phone." checked={f.requireCustomerForCounter} onChange={(v) => sec.set("requireCustomerForCounter", v)} />
      </div>
    </SectionCard>
  );
}

type MethodKey = keyof PaymentSettings;

function PaymentsForm({ s, disabled, onSave }: FormProps) {
  const sec = useSection(s.payments);
  const [errors, setErrors] = useState<FieldErrors>({});
  const p = sec.draft;
  // Nested object: compare per method.
  const dirty = Object.keys(paymentsPatch(s.payments, p)).length > 0;
  const setMethod = <K extends MethodKey>(key: K, patch: Partial<PaymentSettings[K]>) => sec.setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  const submit = () => {
    const trimmed = trimStrings(p);
    const e = paymentErrors(trimmed);
    setErrors(e);
    if (Object.keys(e).length) return;
    void sec.run(() => onSave({ payments: paymentsPatch(s.payments, trimmed) }));
  };
  const text = <K extends MethodKey>(key: K, field: keyof PaymentSettings[K] & string, label: string, hint?: string) => (
    <Field label={label} hint={hint} error={errors[`${key}.${field}`]}>
      <Input value={String(p[key][field] ?? "")} onChange={(e) => setMethod(key, { [field]: e.target.value } as Partial<PaymentSettings[K]>)} aria-invalid={Boolean(errors[`${key}.${field}`])} />
    </Field>
  );
  const qr = <K extends "fonepay" | "esewa" | "khalti" | "bank">(key: K, title: string) => (
    <ImageUpload label={`${title} QR code`} value={p[key].qrImageUrl} onChange={(v) => setMethod(key, { qrImageUrl: v } as Partial<PaymentSettings[K]>)} disabled={disabled} error={errors[`${key}.qrImageUrl`]} />
  );

  return (
    <SectionCard
      title="Payments"
      description="Only switched-on methods show at the counter. QR codes appear large on the payment screen for the customer to scan."
      onSubmit={submit}
      disabled={disabled}
      busy={sec.busy}
      dirty={dirty}
      savedAt={sec.savedAt}
      errors={errors}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <MethodCard title="Cash" enabled onToggle={() => undefined} lockedNote="Always on" />
        <MethodCard title="Card" enabled={p.card.enabled} onToggle={(v) => setMethod("card", { enabled: v })} />
        <MethodCard title="Fonepay" enabled={p.fonepay.enabled} onToggle={(v) => setMethod("fonepay", { enabled: v })}>
          <div className="grid gap-3 sm:grid-cols-2">
            {text("fonepay", "merchantName", "Merchant name")}
            {text("fonepay", "terminalId", "Terminal ID")}
          </div>
          {qr("fonepay", "Fonepay")}
        </MethodCard>
        <MethodCard title="eSewa" enabled={p.esewa.enabled} onToggle={(v) => setMethod("esewa", { enabled: v })}>
          <div className="grid gap-3 sm:grid-cols-2">
            {text("esewa", "accountName", "Account name")}
            {text("esewa", "accountId", "eSewa ID / number", "Shown to the customer")}
          </div>
          {qr("esewa", "eSewa")}
        </MethodCard>
        <MethodCard title="Khalti" enabled={p.khalti.enabled} onToggle={(v) => setMethod("khalti", { enabled: v })}>
          <div className="grid gap-3 sm:grid-cols-2">
            {text("khalti", "accountName", "Account name")}
            {text("khalti", "accountId", "Khalti ID / number", "Shown to the customer")}
          </div>
          {qr("khalti", "Khalti")}
        </MethodCard>
        <MethodCard title="Bank transfer" enabled={p.bank.enabled} onToggle={(v) => setMethod("bank", { enabled: v })}>
          <div className="grid gap-3 sm:grid-cols-2">
            {text("bank", "bankName", "Bank")}
            {text("bank", "branch", "Branch")}
            {text("bank", "accountName", "Account name")}
            {text("bank", "accountNumber", "Account number")}
          </div>
          {qr("bank", "Bank")}
        </MethodCard>
      </div>
    </SectionCard>
  );
}

function MethodCard({ title, enabled, onToggle, lockedNote, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; lockedNote?: string; children?: ReactNode }) {
  return (
    <div className={cn("space-y-3 rounded-xl border p-4", enabled ? "border-border" : "border-dashed border-border bg-muted/40")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold">{title}</p>
        {lockedNote ? <Badge variant="success">{lockedNote}</Badge> : <SwitchField label={<span className="text-sm">{enabled ? "On" : "Off"}</span>} checked={enabled} onChange={onToggle} className="gap-3" />}
      </div>
      {enabled && children}
    </div>
  );
}

const LABEL_SIZES: LabelSize[] = ["38x25", "50x25", "A4-65", "A4-96"];

function LabelsForm({ s, disabled, onSave }: FormProps) {
  const sec = useSection(s.labels);
  const f = sec.draft;
  const testPrint = () => {
    // A code that matches no product, so scanning the test label adds nothing.
    const ok = printLabels([{ code: "TEST-LABEL", name: `${s.store.name} test label`, variant: LABEL_SIZE_NAME[f.size], price: null, sku: null, copies: 1 }], f);
    if (!ok) toast.error("Couldn't open the printer.");
  };
  return (
    <SectionCard
      title="Barcode labels"
      description="Size and content of the labels printed from Stock → Barcode labels and the Print label buttons."
      onSubmit={() => void sec.run(() => onSave({ labels: changedFields(s.labels, f) }))}
      disabled={disabled}
      busy={sec.busy}
      dirty={sec.dirty}
      savedAt={sec.savedAt}
      extra={<Button variant="outline" onClick={testPrint}><Printer className="h-4 w-4" aria-hidden /> Print a test label</Button>}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Label size</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup">
          {LABEL_SIZES.map((size) => (
            <label key={size} className={cn("flex min-h-24 cursor-pointer flex-col justify-between gap-2 rounded-xl border p-4", f.size === size ? "border-rose bg-rose-tint" : "border-border hover:border-rose")}>
              <span className="flex items-center gap-2">
                <input type="radio" name="label-size" className="h-5 w-5 accent-[var(--rose-dark)]" checked={f.size === size} onChange={() => sec.set("size", size)} />
                <span className="font-semibold">{LABEL_SIZE_NAME[size]}</span>
              </span>
              <span className="text-xs text-muted-foreground">{size === "A4-65" ? "Normal printer, A4 label sheets (5 × 13)." : size === "A4-96" ? "A4 label sheets (6 × 16), densest. Test one scan before a full run." : "Label printer roll, one label each."}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="divide-y divide-border rounded-xl border border-border px-4">
        <SwitchField label="Print product name" checked={f.showName} onChange={(v) => sec.set("showName", v)} />
        <SwitchField label="Print price" checked={f.showPrice} onChange={(v) => sec.set("showPrice", v)} />
      </div>
    </SectionCard>
  );
}

function DeliveryForm({ s, disabled, onSave }: FormProps) {
  const sec = useSection(s.delivery);
  const f = sec.draft;
  return (
    <SectionCard title="Delivery (Nepal Can Move)" onSubmit={() => void sec.run(() => onSave({ delivery: changedFields(s.delivery, f) }))} disabled={disabled} busy={sec.busy} dirty={sec.dirty} savedAt={sec.savedAt}>
      <SwitchField label="Book Nepal Can Move automatically when an order is marked Packed" hint="Needs the NCM connection on the server. The Send to NCM button always works." checked={f.ncmEnabled} onChange={(v) => sec.set("ncmEnabled", v)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pickup branch"><Input value={f.ncmPickupBranch} onChange={(e) => sec.set("ncmPickupBranch", e.target.value)} /></Field>
        <Field label="Default delivery type"><Input value={f.defaultDeliveryType} onChange={(e) => sec.set("defaultDeliveryType", e.target.value)} /></Field>
        <Field label="NCM account">
          <Select value={f.ncmEnv} onChange={(e) => sec.set("ncmEnv", e.target.value as "dev" | "prod")}><option value="prod">Live</option><option value="dev">Testing</option></Select>
        </Field>
      </div>
    </SectionCard>
  );
}

function WhatsAppForm({ s, disabled, onSave }: FormProps) {
  const sec = useSection(s.whatsapp);
  const f = sec.draft;
  return (
    <SectionCard title="WhatsApp" onSubmit={() => void sec.run(() => onSave({ whatsapp: changedFields(s.whatsapp, f) }))} disabled={disabled} busy={sec.busy} dirty={sec.dirty} savedAt={sec.savedAt}>
      <div className="divide-y divide-border rounded-xl border border-border px-4">
        <SwitchField label="WhatsApp messages" hint="Order updates to customers and replies from the inbox." checked={f.enabled} onChange={(v) => sec.set("enabled", v)} />
        <SwitchField label="Automatic replies" checked={f.autoReplyEnabled} onChange={(v) => sec.set("autoReplyEnabled", v)} />
        <SwitchField label="Smart (AI) replies" hint="Also needs to be switched on on the server." checked={f.aiReplyEnabled} onChange={(v) => sec.set("aiReplyEnabled", v)} />
      </div>
      <Field label="WhatsApp number shown to customers" className="max-w-sm"><Input value={f.phoneNumberDisplay} onChange={(e) => sec.set("phoneNumberDisplay", e.target.value)} inputMode="tel" /></Field>
    </SectionCard>
  );
}

const ROLE_OPTIONS: Array<{ value: Role; label: string; hint: string }> = [
  { value: "CASHIER", label: "Cashier", hint: "Sells at the counter" },
  { value: "MANAGER", label: "Manager", hint: "Products, stock, orders, reports" },
  { value: "ADMIN", label: "Admin", hint: "Manager + website admin" },
  { value: "SUPER_ADMIN", label: "Super admin", hint: "Everything incl. settings & staff" },
];
const ROLE_NAME: Record<string, string> = { CASHIER: "Cashier", STAFF: "Cashier", MANAGER: "Manager", ADMIN: "Admin", SUPER_ADMIN: "Super admin", OWNER: "Owner" };

function StaffPanel() {
  const me = useAuthStore((s) => s.user);
  const { data, error, loading, reload, setData } = useApi(() => staffApi.list(), []);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("CASHIER");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    try {
      await staffApi.create({ email: email.trim(), name: name.trim() || undefined, role });
      toast.success(`${email.trim()} can now sign in with Google`);
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
    setRowBusy(id);
    try {
      const saved = await staffApi.update(id, patch);
      setData((data ?? []).map((s) => (s.id === id ? { ...s, ...saved } : s)));
      toast.success("Staff updated");
    } catch (err) {
      toastError(err);
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add staff</CardTitle><CardDescription>They sign in with this Google account. No password or PIN needed.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <Field label="Google account email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" /></Field>
            <Field label="Name (optional)"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>
            </Field>
            <Button type="submit" variant="brand" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}><UserPlus className="h-4 w-4" aria-hidden /> {busy ? "Adding…" : "Add"}</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">{ROLE_OPTIONS.map((r) => `${r.label}: ${r.hint}`).join(" · ")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-2 sm:p-4">
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Staff</caption>
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr className="border-b border-border"><th scope="col" className="py-2 pl-2 pr-3">Staff</th><th scope="col" className="py-2 pr-3">Role</th><th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {(data ?? []).map((s) => {
                    const self = s.id === me?.id;
                    const locked = self || s.role === "OWNER";
                    return (
                      <tr key={s.id} className="border-b border-border/60">
                        <td className="py-2 pl-2 pr-3"><span className="block font-medium">{s.name}{self && " (you)"}</span><span className="text-xs text-muted-foreground">{s.email}</span></td>
                        <td className="py-2 pr-3">
                          {locked ? <span>{ROLE_NAME[s.role] ?? s.role}</span> : (
                            <Select aria-label={`Role for ${s.email}`} value={s.role === "STAFF" ? "CASHIER" : s.role} onChange={(e) => void update(s.id, { role: e.target.value })} className="w-40" disabled={rowBusy === s.id}>
                              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </Select>
                          )}
                        </td>
                        <td className="py-2 pr-3"><Badge variant={s.isActive ? "success" : "muted"}>{s.isActive ? "Can sign in" : "Switched off"}</Badge></td>
                        <td className="py-2 text-right">
                          {!locked && <Button size="sm" variant={s.isActive ? "outline" : "default"} onClick={() => void update(s.id, { isActive: !s.isActive })} disabled={rowBusy === s.id}>{s.isActive ? "Switch off" : "Switch on"}</Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data && !data.length && <p className="py-8 text-center text-sm text-muted-foreground">No staff added yet.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
