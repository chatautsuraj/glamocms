/** Code128 barcode helpers for Glamo stock labels (SKU-based). */

export function stockBarcodeValue(sku: string) {
  return sku.trim().toUpperCase();
}

export type BarcodeLabel = {
  sku: string;
  name: string;
  price?: number;
  copies?: number;
};

/** Open printable Code128 labels for stock (USB label printer or A4 sheet). */
export function printStockBarcodes(labels: BarcodeLabel[]) {
  const rows = labels
    .flatMap((l) => {
      const copies = Math.max(1, Math.min(50, l.copies ?? 1));
      const code = stockBarcodeValue(l.sku);
      return Array.from({ length: copies }, () => ({
        ...l,
        code,
      }));
    })
    .map(
      (l, i) => `
      <div class="label" data-i="${i}">
        <p class="brand">Glamo Nepal</p>
        <svg class="bc" data-code="${escapeHtml(l.code)}"></svg>
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

  if (!rows) return false;

  const html = `<!doctype html>
<html><head><title>Glamo stock barcodes</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
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
  .bc{width:160px;height:48px}
  .sku{font-family:ui-monospace,monospace;font-size:11px;margin:2px 0;font-weight:600}
  .name{font-size:10px;margin:0;line-height:1.25;max-height:2.5em;overflow:hidden}
  .price{font-size:11px;font-weight:700;margin:4px 0 0}
  @media print{
    body{margin:0}
    .label{border-color:#bbb}
  }
</style></head><body>
  <h1>Glamo Nepal · stock barcodes</h1>
  <div class="sheet">${rows}</div>
  <script>
    document.querySelectorAll('.bc').forEach(function(el){
      try {
        JsBarcode(el, el.getAttribute('data-code'), {
          format: 'CODE128',
          width: 1.4,
          height: 42,
          displayValue: false,
          margin: 0
        });
      } catch (e) {}
    });
    window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };
  </script>
</body></html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
