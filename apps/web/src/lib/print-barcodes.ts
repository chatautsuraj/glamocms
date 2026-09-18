/** Code128 barcode helpers for Glamo stock labels (SKU-based). No CDN / popup required. */

import JsBarcode from "jsbarcode";

export function stockBarcodeValue(sku: string) {
  return sku.trim().toUpperCase();
}

export type BarcodeLabel = {
  sku: string;
  name: string;
  price?: number;
  copies?: number;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function barcodeSvgMarkup(code: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, code, {
      format: "CODE128",
      width: 1.4,
      height: 42,
      displayValue: false,
      margin: 0,
    });
  } catch {
    return `<text x="0" y="24" font-size="12">${escapeHtml(code)}</text>`;
  }
  svg.setAttribute("class", "bc");
  svg.setAttribute("width", "160");
  svg.setAttribute("height", "48");
  return svg.outerHTML;
}

/** SVG markup for Code128 barcodes in print HTML. */
export function barcodeSvgForPrint(code: string, opts?: { width?: number; height?: number; barWidth?: number }) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const width = opts?.width ?? 220;
  const height = opts?.height ?? 56;
  try {
    JsBarcode(svg, code, {
      format: "CODE128",
      width: opts?.barWidth ?? 1.6,
      height: height - 8,
      displayValue: false,
      margin: 0,
    });
  } catch {
    return `<span style="font-family:monospace;font-size:12px">${escapeHtml(code)}</span>`;
  }
  svg.setAttribute("class", "bc");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  return svg.outerHTML;
}

function buildPrintHtml(labels: BarcodeLabel[]) {
  const rows = labels
    .flatMap((l) => {
      const copies = Math.max(1, Math.min(50, l.copies ?? 1));
      const code = stockBarcodeValue(l.sku);
      return Array.from({ length: copies }, () => ({ ...l, code }));
    })
    .map(
      (l, i) => `
      <div class="label" data-i="${i}">
        <p class="brand">Glamo Nepal</p>
        ${barcodeSvgMarkup(l.code)}
        <p class="sku">${escapeHtml(l.code)}</p>
        <p class="name">${escapeHtml(l.name)}</p>
        ${
          l.price != null
            ? `<p class="price">Rs ${Math.round(l.price).toLocaleString("en-NP")}</p>`
            : ""
        }
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html><head><title>Glamo stock barcodes</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;margin:12px;color:#111}
  h1{font-size:14px;margin:0 0 12px}
  .sheet{display:flex;flex-wrap:wrap;gap:10px}
  .label{
    width:180px;min-height:110px;border:1px dashed #ccc;padding:8px 6px;
    text-align:center;page-break-inside:avoid
  }
  .brand{font-size:10px;font-weight:700;letter-spacing:.04em;margin:0 0 4px;color:#9f2d4a}
  .bc{width:160px;height:48px;display:block;margin:0 auto}
  .sku{font-family:ui-monospace,monospace;font-size:11px;margin:2px 0;font-weight:600}
  .name{font-size:10px;margin:0;line-height:1.25;max-height:2.5em;overflow:hidden}
  .price{font-size:11px;font-weight:700;margin:4px 0 0}
  @media print{ body{margin:0} .label{border-color:#bbb} h1{display:none} }
</style></head><body>
  <h1>Glamo Nepal · stock barcodes</h1>
  <div class="sheet">${rows}</div>
</body></html>`;
}

/** Print via hidden iframe (no popup / no CDN). */
export function printStockBarcodes(labels: BarcodeLabel[]) {
  if (typeof window === "undefined" || !labels.length) return false;

  const html = buildPrintHtml(labels);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print barcodes");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    // Fallback: popup without noopener so we can write
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    }, 250);
    return true;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return false;
  }

  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => iframe.remove(), 1000);
  }, 300);

  return true;
}
