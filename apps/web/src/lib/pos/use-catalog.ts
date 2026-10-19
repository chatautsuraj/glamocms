"use client";

import { useEffect, useRef, useState } from "react";
import { cachedProducts } from "@/lib/offline/catalog-cache";
import type { CachedProduct } from "@/lib/offline/db";
import { runSyncCycle, useOfflineStore } from "@/lib/offline/sync-runner";

const fingerprint = (p: CachedProduct) => `${p.updatedAt ?? ""}|${p.stock}|${p.price}|${p.imageUrl ?? ""}|${p.variants.map((v) => `${v.id}:${v.stock}:${v.price}`).join(",")}`;

/**
 * Sellable products from the IndexedDB catalog cache; reloads after every
 * sync. Unchanged products keep their object identity so memoised tiles don't
 * re-render on each background sync.
 */
export function useCatalog(opts: { includeHidden?: boolean } = {}) {
  const includeHidden = opts.includeHidden ?? false;
  const syncedAt = useOfflineStore((s) => s.catalogSyncedAt);
  const pending = useOfflineStore((s) => s.pending);
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const previous = useRef(new Map<string, { fp: string; product: CachedProduct }>());

  useEffect(() => {
    let alive = true;
    void cachedProducts().then((rows) => {
      if (!alive) return;
      const prev = previous.current;
      const next = new Map<string, { fp: string; product: CachedProduct }>();
      let changed = false;
      const list: CachedProduct[] = [];
      for (const row of rows) {
        if (!includeHidden && !(row.isActive && row.posVisible)) continue;
        const fp = fingerprint(row);
        const old = prev.get(row.id);
        const product = old && old.fp === fp ? old.product : row;
        if (product !== old?.product) changed = true;
        next.set(row.id, { fp, product });
        list.push(product);
      }
      if (list.length !== prev.size) changed = true;
      previous.current = next;
      if (changed || !loaded) setProducts(list);
      setLoaded(true);
      if (!rows.length && !syncedAt) void runSyncCycle({ fullCatalog: true });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `loaded` only gates the first publish
  }, [syncedAt, pending, includeHidden]);

  return { products, loaded, reload: () => runSyncCycle() };
}
