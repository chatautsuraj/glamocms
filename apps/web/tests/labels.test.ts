import "./helpers/print-capture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { barcodeFormatFor, ean13CheckDigit, isValidEan13 } from "../src/lib/print/barcode";
import { defaultCopies, labelRowsFor } from "../src/lib/print/label-rows";
import { expandLabels, labelsHtml, totalLabels, truncate, type LabelItem } from "../src/lib/print/labels";
import type { PosProduct } from "../src/lib/api/types";

test("EAN-13 check digit and validation (in-store 200… range)", () => {
  assert.equal(ean13CheckDigit("200000000001"), 5);
  assert.equal(isValidEan13("2000000000015"), true);
  assert.equal(isValidEan13("2000000000016"), false, "wrong check digit");
  assert.equal(isValidEan13("8901030865275"), true, "manufacturer EAN");
});

test("labels use EAN13 for valid 13-digit codes, CODE128 for everything else", () => {
  assert.equal(barcodeFormatFor("2000000000015"), "EAN13");
  assert.equal(barcodeFormatFor("2000000000016"), "CODE128", "invalid check digit falls back");
  assert.equal(barcodeFormatFor("GLM-MAY-000042"), "CODE128");
  assert.equal(barcodeFormatFor("12345678"), "CODE128");
});

const item = (over: Partial<LabelItem> = {}): LabelItem => ({ code: "2000000000015", name: "Maybelline Fit Me Matte + Poreless Foundation 128 Warm Nude", variant: "128 Warm Nude", price: 1450, sku: "GLM-MAY-000042", copies: 2, ...over });

test("label document: @page matches the size, one barcode per label, EAN13 rendered", () => {
  const html = labelsHtml([item()], { size: "38x25", showName: true, showPrice: true });
  assert.match(html, /@page\{size:38mm 25mm;margin:0\}/);
  assert.equal((html.match(/class="label"/g) ?? []).length, 2, "copies expanded");
  assert.match(html, /data-format="EAN13"/);
  assert.match(html, /Rs 1,450/);
  assert.match(html, /GLM-MAY-000042/);
  assert.match(html, /128 Warm Nude/);
  assert.doesNotMatch(html, /<nav|<header|<script/, "no app chrome");
  const code128 = labelsHtml([item({ code: "GLM-MAY-000042" })], { size: "50x25", showName: true, showPrice: true });
  assert.match(code128, /data-format="CODE128"/);
  assert.match(code128, /@page\{size:50mm 25mm;margin:0\}/);
});

test("showName / showPrice settings hide those parts", () => {
  const html = labelsHtml([item({ copies: 1 })], { size: "38x25", showName: false, showPrice: false });
  assert.doesNotMatch(html, /class="name"/);
  assert.doesNotMatch(html, /class="price"/);
});

test("A4-65 sheets hold 65 labels each", () => {
  const html = labelsHtml([item({ copies: 70 })], { size: "A4-65", showName: true, showPrice: true });
  assert.match(html, /@page\{size:A4;margin:0\}/);
  assert.equal((html.match(/class="sheet"/g) ?? []).length, 2);
  assert.equal((html.match(/class="label"/g) ?? []).length, 70);
});

test("names are truncated; copies are expanded, capped and blank codes skipped", () => {
  assert.equal(truncate("Maybelline Fit Me Matte Foundation", 12), "Maybelline…");
  assert.equal(expandLabels([item({ copies: 3 }), item({ code: " ", copies: 5 })]).length, 3);
  assert.equal(expandLabels([item({ copies: 5000 })], 100).length, 100);
  assert.equal(totalLabels([item({ copies: 3 }), item({ copies: 2.7 })]), 5);
});

test("label rows: one per product, or one per shade, default copies = stock", () => {
  const base = { id: "p1", sku: "GLM-GEN-000001", barcode: "2000000000015", name: "Kajal", brand: "Lakme", category: "Eyes", price: 325, basePrice: 325, salePrice: null, mrp: null, vatApplicable: true, posVisible: true, stock: 7, lowStockThreshold: 3, imageUrl: null, isActive: true, attributes: {}, variants: [], updatedAt: null } as PosProduct;
  const rows = labelRowsFor(base);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "2000000000015");
  const shaded = labelRowsFor({ ...base, variants: [{ id: "v1", name: "Black", sku: "K-B", barcode: "2000000000022", price: 350, stock: 2 }, { id: "v2", name: "Brown", sku: "K-BR", barcode: null, price: 350, stock: 0 }] });
  assert.deepEqual(shaded.map((r) => [r.variant, r.code, r.lowStock]), [["Black", "2000000000022", true], ["Brown", "K-BR", true]]);
  assert.equal(defaultCopies(7), 7);
  assert.equal(defaultCopies(0), 1);
});
