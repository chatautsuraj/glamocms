import { test } from "node:test";
import assert from "node:assert/strict";
import type { PosProduct } from "../src/lib/api/types";
import { toCached } from "../src/lib/offline/db";
import { categoriesOf, searchProducts } from "../src/lib/pos/search";

const p = (id: string, name: string, over: Partial<PosProduct> = {}) => toCached({
  id, sku: `GLM-GEN-00000${id}`, barcode: `20000000000${id}`, name, brand: "Lakme", category: "Eyes", price: 300, basePrice: 300, salePrice: null, mrp: null,
  vatApplicable: true, posVisible: true, stock: 5, lowStockThreshold: 2, imageUrl: null, isActive: true, attributes: {}, variants: [], updatedAt: null, ...over,
});

const catalog = [
  p("1", "Eyeconic Kajal"),
  p("2", "Fit Me Matte Foundation", { brand: "Maybelline", category: "Face", variants: [{ id: "v1", name: "128 Warm Nude", sku: "FM-128", barcode: "2000000000992", price: 1450, stock: 3 }] }),
  p("3", "Kajal Pencil Brown"),
];

test("search ranks exact barcode first, then names starting with the query", () => {
  assert.deepEqual(searchProducts(catalog, "kajal").map((x) => x.id), ["3", "1"], "\"Kajal Pencil…\" starts with the query");
  assert.equal(searchProducts(catalog, "2000000000992")[0].id, "2", "shade barcode finds the product");
  assert.deepEqual(searchProducts(catalog, "fit 128").map((x) => x.id), ["2"], "every word must match (name + shade)");
  assert.deepEqual(searchProducts(catalog, "maybelline").map((x) => x.id), ["2"]);
  assert.equal(searchProducts(catalog, "").length, 3);
});

test("category chips list categories by product count", () => {
  assert.deepEqual(categoriesOf(catalog), [{ name: "Eyes", count: 2 }, { name: "Face", count: 1 }]);
  assert.deepEqual(searchProducts(catalog, "", "Face").map((x) => x.id), ["2"]);
});
