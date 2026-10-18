"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { taxonomyApi } from "@/lib/api/taxonomy";
import { toastError } from "@/lib/notify";
import { useTaxonomy } from "@/lib/catalog-taxonomy";

/**
 * Category or brand picker with "Add new…" inline (POST /pos/categories or
 * /pos/brands). Inactive entries stay selectable only if already chosen.
 */
export function TaxonomySelect({ kind, value, onChange, required, invalid, id }: { kind: "category" | "brand"; value: string; onChange: (id: string) => void; required?: boolean; invalid?: boolean; id?: string }) {
  const items = useTaxonomy((s) => (kind === "category" ? s.categories : s.brands));
  const loaded = useTaxonomy((s) => s.loaded);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const label = kind === "category" ? "category" : "brand";

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      if (kind === "category") {
        const c = await taxonomyApi.createCategory({ name: trimmed });
        useTaxonomy.getState().upsertCategory(c);
        onChange(c.id);
      } else {
        const b = await taxonomyApi.createBrand({ name: trimmed });
        useTaxonomy.getState().upsertBrand(b);
        onChange(b.id);
      }
      setAdding(false);
      setName("");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`New ${label} name`}
          autoFocus
          aria-label={`New ${label} name`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              setAdding(false);
            }
          }}
        />
        <Button variant="default" onClick={() => void add()} disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add"}</Button>
        <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required} aria-invalid={invalid}>
          <option value="">{loaded ? (required ? `Choose ${label}…` : "None") : "Loading…"}</option>
          {items.filter((i) => i.isActive || i.id === value).map((i) => <option key={i.id} value={i.id}>{i.name}{i.isActive ? "" : " (hidden)"}</option>)}
        </Select>
      </div>
      <Button variant="outline" size="icon" aria-label={`Add a new ${label}`} title={`Add a new ${label}`} onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
