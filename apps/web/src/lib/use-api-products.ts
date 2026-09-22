"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  apiProductToUi,
  commerceClient,
  type ApiProduct,
} from "@/lib/commerce-client";

export type UiProduct = ReturnType<typeof apiProductToUi>;

let cache: { at: number; products: ApiProduct[] } | null = null;
const CACHE_MS = 5 * 60_000; // 5 min — catalog rarely changes on Vercel fallback

/** Bust in-memory catalog cache after create/update/adjust. */
export function invalidateProductCache() {
  cache = null;
}

/** Instant on-hand update after a POS sale (avoids full catalog refetch freeze). */
export function patchCachedStockSold(lines: { productId: string; qty: number }[]) {
  if (!cache || !lines.length) return null;
  const sold: Record<string, number> = {};
  for (const line of lines) {
    sold[line.productId] = (sold[line.productId] ?? 0) + Math.max(0, Math.floor(line.qty));
  }
  const products = cache.products.map((p) => {
    const qty = sold[p.id];
    if (!qty) return p;
    return { ...p, stock: Math.max(0, p.stock - qty) };
  });
  cache = { at: Date.now(), products };
  return products;
}

export function useApiProducts() {
  const [products, setProducts] = useState<UiProduct[]>(() =>
    cache ? cache.products.map(apiProductToUi) : [],
  );
  const [raw, setRaw] = useState<ApiProduct[]>(() => cache?.products ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback((list: ApiProduct[]) => {
    setRaw(list);
    setProducts(list.map(apiProductToUi));
  }, []);

  const reload = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.at < CACHE_MS) {
      hydrate(cache.products);
      setLoading(false);
      return;
    }
    // Keep showing cached products while refreshing (no blank flash)
    if (!cache) setLoading(true);
    setError(null);
    try {
      const { products: list } = await commerceClient.listProducts();
      cache = { at: Date.now(), products: list };
      hydrate(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  const applyStockSold = useCallback(
    (lines: { productId: string; qty: number }[]) => {
      const next = patchCachedStockSold(lines);
      if (next) hydrate(next);
    },
    [hydrate],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    products,
    raw,
    loading,
    error,
    reload: () => reload(true),
    applyStockSold,
  };
}

/** Lazy camera scanner — keeps POS first paint lighter. */
export const LazyBarcodeCameraDialog = dynamic(
  () =>
    import("@/components/barcode-camera-dialog").then((m) => m.BarcodeCameraDialog),
  { ssr: false, loading: () => null },
);
