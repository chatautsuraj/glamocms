/** Delivery note print — A4 layout (single or batch), matching warehouse delivery-note style. */

import type { PosOrder } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import type { BillCompany } from "./company";
import { barcodeSvgForPrint } from "./barcode";
import { LOGO_DATA_URL, LOGO_HEIGHT, LOGO_WIDTH } from "./logo";
import { escapeHtml, printDocument } from "./print-document";

/** Embedded logo (data URL) so delivery notes print offline without fetching /public. */
function logoImg(alt: string, size = 72): string {
  return `<img src="${LOGO_DATA_URL}" alt="${escapeHtml(alt)}" width="${size}" height="${Math.round((size * LOGO_HEIGHT) / LOGO_WIDTH)}"/>`;
}

function shortOrderRef(id: string) {
  // New format O00118092026 — show full number; legacy ids stay shortened
  if (/^O\d{3}\d{8}$/i.test(id)) return id.toUpperCase();
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean.slice(-12) || id.slice(0, 12).toUpperCase();
}

function barcodeValue(id: string) {
  // CODE128-safe payload for scanning the order later
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return (clean || id).slice(0, 28);
}

function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NP", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  });
}

function deliveryAddress(order: PosOrder): string {
  const a = order.shippingAddress ?? {};
  return [a.address1, a.city && a.city !== a.address1 ? a.city : null].filter((v) => typeof v === "string" && v.trim()).join(", ");
}

function notePageHtml(order: PosOrder, index: number, total: number, COMPANY: BillCompany): string {
  const orderRef = order.printableRef || order.orderNumber || order.id;
  const ref = shortOrderRef(orderRef);
  const code = barcodeValue(orderRef);
  const barcode = barcodeSvgForPrint(code, { width: 280, height: 64, barWidth: 1.8 });
  const orderDate = formatDay(order.createdAt);
  const shipDate = formatDay(order.shipment?.createdAt || order.createdAt);
  const customerName = order.shippingAddress?.fullName || order.customer?.name || "Walk-in";
  const phone = order.shippingAddress?.phone || order.customer?.phone || "—";
  const address = deliveryAddress(order).trim() || "Address not set";
  const notes = order.notes?.trim() || "";
  const assignee = order.shipment ? "Nepal Can Move" : "—";
  const legal = COMPANY.legalName?.trim() && COMPANY.legalName.trim() !== COMPANY.name.trim() ? COMPANY.legalName.trim() : "";
  const tracking = order.shipment?.trackingCode
    ? `<p>NCM tracking: <strong class="mono">${escapeHtml(order.shipment.trackingCode)}</strong></p>`
    : "";

  const lines = order.items?.length
    ? order.items
        .map((line, i) => {
          const sku = line.sku || line.productId || line.id || "—";
          const name = line.variantName ? `${line.name} — ${line.variantName}` : line.name || "Item";
          return `<tr>
            <td>${i + 1}</td>
            <td class="mono">${escapeHtml(String(sku))}</td>
            <td>${escapeHtml(name)}</td>
            <td class="right">${line.quantity}</td>
            <td class="right">${escapeHtml(formatNPR(Number(line.unitPrice)))}</td>
            <td class="right">${escapeHtml(formatNPR(Number(line.lineTotal)))}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="muted">No line items on this order</td></tr>`;

  return `
  <section class="note">
    <header class="top">
      <div class="title-block">
        <h1>Delivery note</h1>
        ${total > 1 ? `<p class="batch">Stop ${index + 1} of ${total}</p>` : ""}
      </div>
      <div class="brand">
        <div class="logo">${logoImg(COMPANY.name, 72)}</div>
        <div class="brand-text">
          <strong>${escapeHtml(COMPANY.name)}</strong>
${legal ? `          <span>${escapeHtml(legal)}</span>\n` : ""}          <span>${escapeHtml(COMPANY.address)}</span>
          <span>${escapeHtml(COMPANY.phone)}</span>
        </div>
      </div>
    </header>

    <hr />

    <h2>Shipping order</h2>
    <div class="meta-row">
      <div><span class="lbl">Shipping order</span><br/><strong class="mono">${escapeHtml(ref)}</strong></div>
      <div><span class="lbl">Order date</span><br/><strong>${escapeHtml(orderDate)}</strong></div>
      <div><span class="lbl">Ship / schedule</span><br/><strong>${escapeHtml(shipDate)}</strong></div>
      <div><span class="lbl">Channel</span><br/><strong>${escapeHtml(order.channel)}</strong></div>
    </div>

    <div class="barcode-wrap">
      ${barcode}
      <div class="mono bc-text">${escapeHtml(code)}</div>
    </div>

    <div class="addrs">
      <div class="box">
        <h3>Target (deliver to)</h3>
        <p><strong>${escapeHtml(customerName)}</strong></p>
        <p>${escapeHtml(address)}</p>
        <p>Tel: ${escapeHtml(phone)}</p>
        ${notes ? `<p class="notes">Notes: ${escapeHtml(notes)}</p>` : ""}
        <p>Assignee: ${escapeHtml(assignee)}</p>
        <p>Payment: ${escapeHtml(order.paymentStatus)} · ${escapeHtml(formatNPR(Number(order.totalAmount)))}</p>${tracking}
      </div>
      <div class="box">
        <h3>Source (from)</h3>
        <div class="source-brand">
          <div class="logo-sm">${logoImg(COMPANY.name, 40)}</div>
          <div>
            <p><strong>${escapeHtml(COMPANY.name)}</strong></p>
${legal ? `            <p>${escapeHtml(legal)}</p>\n` : ""}            <p>${escapeHtml(COMPANY.address)}</p>
            <p>Tel: ${escapeHtml(COMPANY.phone)}</p>
            <p>${escapeHtml(COMPANY.email ?? "")}</p>
          </div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Line</th>
          <th>Item</th>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Rate</th>
          <th class="right">Amt</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>

    <div class="sign">
      <div>Received by: ______________________</div>
      <div>Driver: ______________________</div>
      <div>Date: ______________________</div>
    </div>
  </section>`;
}

const STYLES = `
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:0;padding:0;background:#fff}
  .note{max-width:800px;margin:0 auto;padding:28px 32px;page-break-after:always}
  .note:last-child{page-break-after:auto}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  h1{font-size:28px;margin:0;font-weight:700;letter-spacing:-.02em}
  h2{font-size:15px;margin:14px 0 8px;font-weight:700}
  h3{font-size:13px;margin:0 0 8px;font-weight:700}
  .brand{display:flex;align-items:center;gap:12px;text-align:right;font-size:12px;line-height:1.4;color:#333}
  .brand-text{text-align:right}
  .brand-text strong{display:block;font-size:14px;color:#111}
  .brand-text span{display:block}
  .logo svg{display:block;width:72px;height:72px}
  .logo-sm svg{display:block;width:40px;height:40px}
  .source-brand{display:flex;gap:10px;align-items:flex-start}
  .batch{margin:4px 0 0;font-size:12px;color:#555}
  hr{border:none;border-top:1px solid #222;margin:14px 0}
  .meta-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:13px;margin-bottom:12px}
  .lbl{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.04em}
  .mono{font-family:ui-monospace,Menlo,Consolas,monospace}
  .barcode-wrap{text-align:center;margin:16px 0 20px}
  .barcode-wrap svg{display:inline-block;max-width:100%}
  .bc-text{font-size:11px;margin-top:4px;letter-spacing:.06em}
  .addrs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
  .box{border:1px solid #ccc;border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.45;min-height:140px}
  .box p{margin:0 0 4px}
  .notes{margin-top:6px!important;color:#333}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
  th,td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left;vertical-align:top}
  th{border-bottom:2px solid #222;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
  .right{text-align:right}
  .muted{color:#777;font-style:italic}
  .sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:28px;font-size:12px;color:#333}
  @media print{
    body{padding:0}
    .note{padding:12mm;max-width:none}
  }
  @media (max-width:640px){
    .meta-row,.addrs,.sign{grid-template-columns:1fr}
  }
`;

export type DeliveryPrintOpts = {
  orders: PosOrder[];
  /** Sender block (store settings). */
  company: BillCompany;
  /** Shown in document title only */
  rangeLabel?: string;
};

/** Delivery notes HTML, one A4 page per order (no script; printing is triggered by printDocument). */
export function deliveryNotesHtml(opts: DeliveryPrintOpts): string {
  const { orders, rangeLabel, company } = opts;

  const pages = orders.map((o, i) => notePageHtml(o, i, orders.length, company)).join("");
  const title =
    orders.length === 1
      ? `Delivery note ${shortOrderRef(orders[0].printableRef || orders[0].orderNumber || orders[0].id)}`
      : `Delivery notes (${orders.length})${rangeLabel ? ` — ${rangeLabel}` : ""}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>${STYLES}</style></head><body>
${pages}
</body></html>`;

  return html;
}

/** Print one delivery note per order (batch = multi-page). */
export function printDeliveryNotes(opts: DeliveryPrintOpts): boolean {
  if (!opts.orders.length) return false;
  return printDocument(deliveryNotesHtml(opts));
}

/** Convenience: print a single order’s delivery note. */
export function printDeliveryNote(order: PosOrder, company: BillCompany): boolean {
  return printDeliveryNotes({ orders: [order], company });
}
