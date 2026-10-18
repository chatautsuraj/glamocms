"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { customersApi } from "@/lib/api/customers";
import type { Customer } from "@/lib/api/types";
import type { CartCustomer } from "@/lib/pos/cart";
import { formatNPR } from "@/lib/format";
import { useOfflineStore } from "@/lib/offline/sync-runner";

/** Look up an existing customer (GET /pos/customers) or type name/phone for a new one. */
export function CustomerPicker({ open, onOpenChange, onPick, initial, requireAddress }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (c: CartCustomer | null) => void;
  initial?: CartCustomer | null;
  requireAddress?: boolean;
}) {
  const online = useOfflineStore((s) => s.online);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<CartCustomer>({ name: "", phone: "", email: "", address: "" });

  useEffect(() => {
    if (open) {
      setDraft({ name: initial?.name ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", address: initial?.address ?? "" });
      setQ("");
      setResults([]);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open || !online || q.trim().length < 2) return;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults((await customersApi.list({ q: q.trim() })).items);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, online]);

  const useDraft = () => {
    if (!draft.name?.trim() && !draft.phone?.trim()) return;
    onPick({ ...draft, id: undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Customer" className="max-w-xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Customer</DialogTitle>
          <DialogDescription>Search by name or phone. Leave empty for a walk-in sale.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="relative block">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={online ? "Name or phone…" : "Offline — enter details below"} disabled={!online} />
          </label>
          {searching && <p className="text-xs text-muted-foreground" role="status">Searching…</p>}
          {results.length > 0 && (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      onPick({ id: c.id, name: c.name, phone: c.phone ?? undefined, email: c.email ?? undefined, address: c.address ?? undefined, khataBalance: c.khataBalance });
                      onOpenChange(false);
                    }}
                  >
                    <span>
                      <span className="block text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                    </span>
                    {(c.khataBalance ?? 0) > 0 && <span className="text-xs text-warning">Khata {formatNPR(c.khataBalance ?? 0)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
            <p className="col-span-full flex items-center gap-2 text-sm font-medium"><UserPlus className="h-4 w-4" aria-hidden /> New / walk-in with details</p>
            <Field label="Name"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" /></Field>
            <Field label="Mobile"><Input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" autoComplete="off" /></Field>
            <Field label="Email (optional)"><Input type="email" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} autoComplete="off" /></Field>
            <Field label={requireAddress ? "Address" : "Address (optional)"}><Input value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} autoComplete="off" /></Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {initial && (
              <Button variant="outline" onClick={() => { onPick(null); onOpenChange(false); }}>
                <X className="h-4 w-4" /> Walk-in (clear)
              </Button>
            )}
            <Button onClick={useDraft} disabled={!draft.name?.trim() && !draft.phone?.trim()}>Use these details</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
