"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { customersApi } from "@/lib/api/customers";
import type { Customer } from "@/lib/api/types";
import { normalizeNepalMobile, validateOrderCustomer, type OrderCustomerErrors } from "@/lib/pos/customer";
import { toastError } from "@/lib/notify";

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customer: Customer | null; onSaved: (c: Customer) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<OrderCustomerErrors & { email?: string }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setEmail(customer?.email ?? "");
    setAddress(customer?.address ?? "");
    setConsent(customer?.marketingConsent ?? false);
    setErrors({});
  }, [open, customer]);

  const submit = async () => {
    const next: typeof errors = validateOrderCustomer({ name, phone, address }, { requireAddress: false });
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email, or leave it empty.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const mobile = normalizeNepalMobile(phone);
    setBusy(true);
    try {
      const saved = customer
        ? await customersApi.update(customer.id, { name: name.trim(), phone: mobile, email: email.trim() || null, address: address.trim(), marketingConsent: consent })
        : await customersApi.create({ name: name.trim(), phone: mobile, email: email.trim() || undefined, address: address.trim() || undefined, marketingConsent: consent });
      toast.success(customer ? "Customer saved" : "Customer added");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={customer ? "Edit customer" : "New customer"}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader><DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
        <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Name *" error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} autoComplete="off" /></Field>
          <Field label="Mobile *" hint="10 digits, starting with 98 or 97" error={errors.phone}><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" aria-invalid={Boolean(errors.phone)} autoComplete="off" /></Field>
          <Field label="Email" error={errors.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} autoComplete="off" /></Field>
          <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></Field>
          <CheckField label="Agrees to receive offers on WhatsApp" hint="Needed before offer messages can be sent to this customer." checked={consent} onChange={setConsent} />
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
