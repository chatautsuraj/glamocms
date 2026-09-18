import catalog from "./glamo-catalog.json";

export type CatalogProduct = {
  id: string; sku: string; barcode: string; name: string; brand: string;
  category: string; size: string; unit: string; mrp: number; tradePrice: number;
  stock: number; reorderAt: number; vat: number; galla: boolean; tenantId: string;
  image?: string; shade?: string; batchNumber?: string; expiresOn?: string;
  paoMonths?: string; isTester?: boolean; origin?: string; subCategory?: string;
  sourceUrl?: string; sourceListedPrice?: number; sourceStockSnapshot?: number;
  sourceImportedAt?: string;
};

export const CATALOG_SOURCE = { name: "Glamo Nepal", url: "https://www.glamonepal.com/shop", date: "2026-09-17", count: catalog.length };

// Published catalog snapshot, duplicated into the two isolated demonstration stores.
// Barcodes, batch numbers and expiry dates were not published and are left blank.
export const GLAMO_PRODUCTS: CatalogProduct[] = ["t1", "t2"].flatMap((tenantId) =>
  catalog.map((p) => ({
    id: `${tenantId}-${p.sourceId}`, tenantId, sku: p.sku, barcode: "",
    name: p.name, brand: p.brand, category: p.category, subCategory: p.subCategory,
    size: p.size, unit: "PCS", mrp: Math.max(p.regularPrice, p.price), tradePrice: p.price,
    stock: p.stock, reorderAt: p.reorderAt, vat: 13, galla: true,
    image: p.image, shade: "", batchNumber: "", expiresOn: "", paoMonths: "", isTester: false,
    origin: p.origin, sourceUrl: p.sourceUrl, sourceListedPrice: p.price,
    sourceStockSnapshot: p.stock, sourceImportedAt: p.importedAt,
  }))
);
