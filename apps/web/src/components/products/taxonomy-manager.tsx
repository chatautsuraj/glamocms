"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, X } from "lucide-react";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SwitchField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { taxonomyApi } from "@/lib/api/taxonomy";
import { useTaxonomy } from "@/lib/catalog-taxonomy";
import { toastError } from "@/lib/notify";

type Item = { id: string; name: string; isActive: boolean; productCount?: number };

/** Manage categories and brands: add, rename, hide. */
export function TaxonomyManager() {
  const categories = useTaxonomy((s) => s.categories);
  const brands = useTaxonomy((s) => s.brands);
  const loaded = useTaxonomy((s) => s.loaded);
  const error = useTaxonomy((s) => s.error);
  useEffect(() => {
    void useTaxonomy.getState().load(true);
  }, []);

  if (error && !loaded) return <ErrorPanel error={error} onRetry={() => void useTaxonomy.getState().load(true)} />;
  if (!loaded) return <LoadingRows rows={6} />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TaxonomyCard
        title="Categories"
        noun="category"
        items={categories}
        onCreate={async (name) => useTaxonomy.getState().upsertCategory(await taxonomyApi.createCategory({ name }))}
        onUpdate={async (id, patch) => useTaxonomy.getState().upsertCategory(await taxonomyApi.updateCategory(id, patch))}
      />
      <TaxonomyCard
        title="Brands"
        noun="brand"
        items={brands}
        onCreate={async (name) => useTaxonomy.getState().upsertBrand(await taxonomyApi.createBrand({ name }))}
        onUpdate={async (id, patch) => useTaxonomy.getState().upsertBrand(await taxonomyApi.updateBrand(id, patch))}
      />
    </div>
  );
}

function TaxonomyCard({ title, noun, items, onCreate, onUpdate }: {
  title: string;
  noun: string;
  items: Item[];
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, patch: { name?: string; isActive?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      return true;
    } catch (err) {
      toastError(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>{title} <span className="font-normal text-muted-foreground">· {items.length}</span></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (name.trim() && (await run(() => onCreate(name.trim()), `${title.slice(0, -1)} added`))) setName(""); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${noun} name`} aria-label={`New ${noun} name`} />
          <Button type="submit" disabled={busy || !name.trim()}><Plus className="h-4 w-4" aria-hidden /> Add</Button>
        </form>
        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-lg border border-border scrollbar-thin">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-1.5">
              {editing?.id === item.id ? (
                <form className="flex flex-1 gap-1" onSubmit={async (e) => { e.preventDefault(); if (editing.name.trim() && (await run(() => onUpdate(item.id, { name: editing.name.trim() }), "Renamed"))) setEditing(null); }}>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label={`Rename ${item.name}`} autoFocus />
                  <Button type="submit" size="icon" variant="ghost" aria-label="Save name" disabled={busy}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                  {item.productCount !== undefined && <Badge variant="muted">{item.productCount} products</Badge>}
                  <Button size="icon" variant="ghost" aria-label={`Rename ${item.name}`} onClick={() => setEditing({ id: item.id, name: item.name })}><Pencil className="h-4 w-4" /></Button>
                  <SwitchField label={<span className="sr-only">Show {item.name}</span>} checked={item.isActive} disabled={busy} onChange={(v) => void run(() => onUpdate(item.id, { isActive: v }), v ? "Shown" : "Hidden")} className="min-h-10 gap-0" />
                </>
              )}
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">None yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
