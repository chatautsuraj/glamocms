import { GLAMO_PRODUCTS } from "./catalog";
import legacyCatalog from "./legacy-cosmetics-catalog.json";
import type { Product, PriceList, PriceListItem, CustomerSpecialPrice, ProductCategory } from "./store";

type History = { items?: { productId: string }[] };
export type CatalogState = {
  products?: Product[]; categories?: ProductCategory[];
  priceLists?: PriceList[]; priceListItems?: PriceListItem[];
  specialPrices?: CustomerSpecialPrice[];
  invoices?: History[]; orders?: History[]; purchaseOrders?: History[];
};

/** Upgrade demo catalog without overwriting edits or deleting transaction-linked SKUs. */
export function migrateGlamoCatalog<T extends CatalogState>(state: T): T {
  const referenced = new Set(
    [...(state.invoices ?? []), ...(state.orders ?? []), ...(state.purchaseOrders ?? [])]
      .flatMap((row) => row.items ?? []).map((item) => item.productId)
  );
  const removed = new Set<string>();
  const products = (state.products ?? []).filter((p) => {
    const legacy = legacyCatalog.find((x) => x.id === p.id);
    const untouched = legacy && Object.entries(legacy).every(([key, value]) => p[key as keyof Product] === value)
      && !p.image && !p.isTester;
    if (untouched && !referenced.has(p.id)) { removed.add(p.id); return false; }
    return true;
  });
  const ids = new Set(products.map((p) => p.id));
  for (const p of GLAMO_PRODUCTS) if (!ids.has(p.id)) products.push(p);
  const priceListItems = (state.priceListItems ?? []).filter((p) => !removed.has(p.productId));
  for (const list of state.priceLists ?? []) {
    for (const p of GLAMO_PRODUCTS.filter((p) => p.tenantId === list.tenantId)) {
      if (!priceListItems.some((i) => i.productId === p.id && i.priceListId === list.id)) {
        priceListItems.push({id:`glamo-rate-${list.id}-${p.id}`,priceListId:list.id,productId:p.id,unitPrice:p.tradePrice,effectiveFrom:"2026-09-17",effectiveTo:null});
      }
    }
  }
  const categories = [...(state.categories ?? [])];
  for (const p of products) if (!categories.some((c) => c.tenantId === p.tenantId && c.name === p.category)) {
    categories.push({id:`glamo-category-${p.tenantId}-${p.category}`,tenantId:p.tenantId,name:p.category});
  }
  return {...state,products,priceListItems,categories,specialPrices:(state.specialPrices??[]).filter(p=>!removed.has(p.productId))};
}
