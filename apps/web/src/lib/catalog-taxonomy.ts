/** Categories & brands, loaded once and shared by the product screens. */
import { create } from "zustand";
import { taxonomyApi } from "@/lib/api/taxonomy";
import type { Brand, Category } from "@/lib/api/types";

interface TaxonomyState {
  categories: Category[];
  brands: Brand[];
  loaded: boolean;
  error: unknown;
  load: (force?: boolean) => Promise<void>;
  upsertCategory: (c: Category) => void;
  upsertBrand: (b: Brand) => void;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
const upsert = <T extends { id: string; name: string }>(list: T[], item: T) => [...list.filter((x) => x.id !== item.id), item].sort(byName);

let inflight: Promise<void> | null = null;

export const useTaxonomy = create<TaxonomyState>((set, get) => ({
  categories: [],
  brands: [],
  loaded: false,
  error: null,
  load(force = false) {
    if (get().loaded && !force) return Promise.resolve();
    inflight ??= Promise.all([taxonomyApi.categories(), taxonomyApi.brands()])
      .then(([categories, brands]) => set({ categories: [...categories].sort(byName), brands: [...brands].sort(byName), loaded: true, error: null }))
      .catch((error: unknown) => set({ error }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  upsertCategory: (c) => set({ categories: upsert(get().categories, c) }),
  upsertBrand: (b) => set({ brands: upsert(get().brands, b) }),
}));
