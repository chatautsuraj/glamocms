"use client";

import { useEffect, useState } from "react";
import { Phone, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { customersApi } from "@/lib/api/customers";
import type { Customer } from "@/lib/api/types";
import type { CartCustomer } from "@/lib/pos/cart";
import { counterPhoneError, normalizeNepalMobile } from "@/lib/pos/customer";
import { useOfflineStore } from "@/lib/offline/sync-runner";

/**
 * Counter sales are walk-in by default. This small control lets the cashier
 * attach a phone number (and optionally a name) — never required unless the
 * owner switched on "require customer" in Settings.
 */
export function CustomerChip({ customer, onChange, required }: { customer: CartCustomer | null; onChange: (c: CartCustomer | null) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = customer?.name || customer?.phone;
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {label ? (
          <span className="flex min-w-0 items-center gap-1.5 max-w-full rounded-full bg-rose-tint pl-3 text-sm font-medium">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden />
            <button type="button" className="min-h-11 min-w-0 truncate hover:underline" onClick={() => setOpen(true)} title="Change customer">
              {label}
            </button>
            <Button variant="ghost" size="icon-sm" className="h-11 w-11 shrink-0" aria-label="Remove customer (walk-in)" onClick={() => onChange(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </span>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">Walk-in</span>
            <Button variant="link" size="sm" className="min-h-11 px-1 text-sm" onClick={() => setOpen(true)}>
              <Phone className="h-3.5 w-3.5" aria-hidden /> {required ? "Add customer phone (required)" : "Add customer (phone)"}
            </Button>
          </>
        )}
      </div>
      <CustomerPhoneDialog open={open} onOpenChange={setOpen} initial={customer} onSave={onChange} />
    </>
  );
}

function CustomerPhoneDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial: CartCustomer | null; onSave: (c: CartCustomer | null) => void }) {
  const online = useOfflineStore((s) => s.online);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone(initial?.phone ?? "");
    setName(initial?.name ?? "");
    setMatches([]);
    setTouched(false);
  }, [open, initial]);

  const digits = normalizeNepalMobile(phone);
  useEffect(() => {
    if (!open || !online || digits.length < 6) {
      setMatches([]);
      return;
    }
    const t = window.setTimeout(() => {
      customersApi.list({ q: digits }).then((r) => setMatches(r.items.slice(0, 5))).catch(() => setMatches([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [digits, open, online]);

  const error = counterPhoneError(phone);
  const save = () => {
    setTouched(true);
    if (!phone.trim() || error) return;
    onSave({ phone: digits, name: name.trim() || undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Add customer" className="max-w-md">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>Optional. The bill and the sale will show this customer.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Mobile number" error={touched ? error : null}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" placeholder="98XXXXXXXX" aria-invalid={touched && Boolean(error)} autoFocus className="h-12 text-lg tabular" />
          </Field>
          {matches.length > 0 && (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border" aria-label="Existing customers">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onClick={() => {
                      onSave({ id: c.id, name: c.name, phone: c.phone ?? undefined, email: c.email ?? undefined });
                      onOpenChange(false);
                    }}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular text-sm text-muted-foreground">{c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Field label="Name (optional)">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="brand">Add to sale</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
