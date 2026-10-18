"use client";

import { useEffect, useState } from "react";
import { cachedProducts } from "@/lib/offline/catalog-cache";
import type { CachedProduct } from "@/lib/offline/db";
import { runSyncCycle, useOfflineStore } from "@/lib/offline/sync-runner";

/** Sellable products from the IndexedDB catalog cache; reloads after every sync. */
export function useCatalog() {
  const syncedAt = useOfflineStore((s) => s.catalogSyncedAt);
  const pending = useOfflineStore((s) => s.pending);
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void cachedProducts().then((rows) => {
      if (!alive) return;
      setProducts(rows.filter((p) => p.isActive && p.posVisible));
      setLoaded(true);
      if (!rows.length && !syncedAt) void runSyncCycle({ fullCatalog: true });
    });
    return () => { alive = false; };
  }, [syncedAt, pending]);

  return { products, loaded, reload: () => runSyncCycle() };
}
