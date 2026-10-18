"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckField, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { customersApi } from "@/lib/api/customers";
import type { Customer } from "@/lib/api/types";
import { toastError } from "@/lib/notify";

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customer: Customer | null; onSaved: (c: Customer) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setEmail(customer?.email ?? "");
    setAddress(customer?.address ?? "");
    setConsent(customer?.marketingConsent ?? false);
  }, [open, customer]);
  const submit = async () => {
    setBusy(true);
    try {
      const saved = customer
        ? await customersApi.update(customer.id, { name: name.trim(), phone: phone.trim(), email: email.trim() || null, address: address.trim(), marketingConsent: consent })
        : await customersApi.create({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, address: address.trim() || undefined, marketingConsent: consent });
      toast.success(customer ? "Customer updated" : "Customer added");
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
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Name *"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Mobile *" hint="10-digit Nepal mobile"><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <CheckField label="Agrees to WhatsApp offers" hint="Needed before broadcasts can reach this customer." checked={consent} onChange={setConsent} />
          <Button type="submit" className="w-full" disabled={busy || !name.trim() || phone.replace(/\D/g, "").length < 10}>{busy ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
