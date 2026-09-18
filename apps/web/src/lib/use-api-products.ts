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

export function useApiProducts() {
  const [products, setProducts] = useState<UiProduct[]>(() =>
    cache ? cache.products.map(apiProductToUi) : [],
  );
  const [raw, setRaw] = useState<ApiProduct[]>(() => cache?.products ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.at < CACHE_MS) {
      setRaw(cache.products);
      setProducts(cache.products.map(apiProductToUi));
      setLoading(false);
      return;
    }
    // Keep showing cached products while refreshing (no blank flash)
    if (!cache) setLoading(true);
    setError(null);
    try {
      const { products: list } = await commerceClient.listProducts();
      cache = { at: Date.now(), products: list };
      setRaw(list);
      setProducts(list.map(apiProductToUi));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { products, raw, loading, error, reload: () => reload(true) };
}

/** Lazy camera scanner — keeps POS first paint lighter. */
export const LazyBarcodeCameraDialog = dynamic(
  () =>
    import("@/components/barcode-camera-dialog").then((m) => m.BarcodeCameraDialog),
  { ssr: false, loading: () => null },
);
