/**
 * Shelf / product barcode labels. Size and content come from Settings →
 * Labels (posConfig.labels):
 *  - 38x25 / 50x25: thermal label roll, one label per printed page;
 *  - A4-65: A4 sheet of 65 labels (5 × 13, 38.1 × 21.2 mm).
 * Each label: product name (one line), shade/variant, barcode (EAN-13 when
 * the code is a valid EAN-13, otherwise CODE128) with digits, price, SKU.
 */
import type { LabelSettings, LabelSize } from "@/lib/api/types";
import { labelBarcodeSvg } from "./barcode";
import { escapeHtml, printDocument } from "./print-document";

export interface LabelItem {
  /** Barcode value (product / shade barcode, else SKU). */
  code: string;
  name: string;
  variant?: string | null;
  price?: number | null;
  sku?: string | null;
  copies: number;
}

interface LabelLayout {
  /** Label width × height in mm. */
  width: number;
  height: number;
  /** Barcode box height in mm. */
  barcodeHeight: number;
  nameSize: number;
  smallSize: number;
  priceSize: number;
  /** Characters kept from the product name (CSS ellipsis does the rest). */
  nameChars: number;
  sheet: null | { cols: number; rows: number; marginTop: number; marginLeft: number; gapX: number };
}

export const LABEL_LAYOUTS: Record<LabelSize, LabelLayout> = {
  "38x25": { width: 38, height: 25, barcodeHeight: 10.5, nameSize: 6.5, smallSize: 5.2, priceSize: 8, nameChars: 34, sheet: null },
  "50x25": { width: 50, height: 25, barcodeHeight: 10.5, nameSize: 7, smallSize: 5.5, priceSize: 8.5, nameChars: 46, sheet: null },
  "A4-65": { width: 38.1, height: 21.2, barcodeHeight: 8.5, nameSize: 6, smallSize: 5, priceSize: 7.5, nameChars: 34, sheet: { cols: 5, rows: 13, marginTop: 10.7, marginLeft: 4.75, gapX: 2.5 } },
  "A4-96": { width: 32, height: 17, barcodeHeight: 6.8, nameSize: 5.4, smallSize: 4.6, priceSize: 6.8, nameChars: 28, sheet: { cols: 6, rows: 16, marginTop: 11.5, marginLeft: 3, gapX: 3 } },
};

export const LABEL_SIZE_NAME: Record<LabelSize, string> = {
  "38x25": "38 × 25 mm roll",
  "50x25": "50 × 25 mm roll",
  "A4-65": "A4 sheet, 65 labels",
  "A4-96": "A4 sheet, 96 labels (dense)",
};

/** Hard cap per print job so a mistyped quantity can't spool thousands of pages. */
export const MAX_LABELS_PER_JOB = 2000;

export function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…` : t;
}

/** One entry per physical label (copies expanded, invalid rows dropped, capped). */
export function expandLabels(items: LabelItem[], cap = MAX_LABELS_PER_JOB): LabelItem[] {
  const out: LabelItem[] = [];
  for (const item of items) {
    if (!item.code.trim()) continue;
    const copies = Math.max(0, Math.floor(item.copies));
    for (let i = 0; i < copies && out.length < cap; i++) out.push(item);
  }
  return out;
}

export function totalLabels(items: Array<Pick<LabelItem, "copies" | "code">>): number {
  return items.reduce((s, i) => s + (i.code.trim() ? Math.max(0, Math.floor(i.copies)) : 0), 0);
}

function priceText(n: number) {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

function labelHtml(item: LabelItem, layout: LabelLayout, settings: LabelSettings): string {
  const name = settings.showName ? `<div class="name">${escapeHtml(truncate(item.name, layout.nameChars))}</div>` : "";
  const variant = item.variant ? `<div class="variant">${escapeHtml(truncate(item.variant, layout.nameChars))}</div>` : "";
  const price = settings.showPrice && item.price != null ? `<span class="price">${escapeHtml(priceText(item.price))}</span>` : "<span></span>";
  const sku = item.sku ? `<span class="sku">${escapeHtml(truncate(item.sku, 22))}</span>` : "";
  return `<div class="label">${name}${variant}<div class="code">${labelBarcodeSvg(item.code)}<div class="digits">${escapeHtml(item.code.trim())}</div></div><div class="foot">${price}${sku}</div></div>`;
}

function styles(size: LabelSize): string {
  const l = LABEL_LAYOUTS[size];
  const page = l.sheet ? "size:A4;margin:0" : `size:${l.width}mm ${l.height}mm;margin:0`;
  const sheet = l.sheet
    ? `.sheet{width:210mm;height:297mm;box-sizing:border-box;padding:${l.sheet.marginTop}mm 0 0 ${l.sheet.marginLeft}mm;display:grid;grid-template-columns:repeat(${l.sheet.cols},${l.width}mm);grid-auto-rows:${l.height}mm;column-gap:${l.sheet.gapX}mm;align-content:start;break-after:page;page-break-after:always}
  .sheet:last-child{break-after:auto;page-break-after:auto}`
    : `.label{break-after:page;page-break-after:always}
  .label:last-child{break-after:auto;page-break-after:auto}`;
  return `*{box-sizing:border-box}
  @page{${page}}
  html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .label{width:${l.width}mm;height:${l.height}mm;padding:1mm 1.6mm;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between}
  .name{font-size:${l.nameSize}pt;font-weight:700;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .variant{font-size:${l.smallSize}pt;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .code{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:0}
    .bc{display:block;width:${l.width - 5}mm;max-width:100%;height:${l.barcodeHeight}mm}
  .digits{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:${l.smallSize + 0.6}pt;letter-spacing:.06em;line-height:1.1}
  .bc rect{shape-rendering:crispEdges}
  .bc-fallback{font-family:ui-monospace,monospace;font-size:${l.nameSize}pt}
  .foot{display:flex;justify-content:space-between;align-items:baseline;gap:1mm;line-height:1}
  .price{font-size:${l.priceSize}pt;font-weight:700;white-space:nowrap}
  .sku{font-size:${l.smallSize}pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ${sheet}`;
}

/** Full print document for the labels (no app chrome, @page matches the label size). */
export function labelsHtml(items: LabelItem[], settings: LabelSettings): string {
  const layout = LABEL_LAYOUTS[settings.size] ?? LABEL_LAYOUTS["38x25"];
  const size = LABEL_LAYOUTS[settings.size] ? settings.size : "38x25";
  const labels = expandLabels(items).map((item) => labelHtml(item, layout, settings));
  let body: string;
  if (layout.sheet) {
    const perSheet = layout.sheet.cols * layout.sheet.rows;
    const sheets: string[] = [];
    for (let i = 0; i < labels.length; i += perSheet) sheets.push(`<div class="sheet">${labels.slice(i, i + perSheet).join("")}</div>`);
    body = sheets.join("\n");
  } else {
    body = labels.join("\n");
  }
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Barcode labels</title>
<style>${styles(size)}</style></head><body>
${body}
</body></html>`;
}

/** Print labels through the hidden print frame. Returns false when there is nothing to print. */
export function printLabels(items: LabelItem[], settings: LabelSettings): boolean {
  if (!totalLabels(items)) return false;
  return printDocument(labelsHtml(items, settings));
}
