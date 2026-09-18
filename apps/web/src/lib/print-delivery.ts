/** Delivery note print — A4 layout (single or batch), matching warehouse delivery-note style. */

import type { ApiOrder } from "@/lib/commerce-client";
import { COMPANY } from "@/lib/mock-data";
import { barcodeSvgForPrint } from "@/lib/print-barcodes";
import { formatNPR } from "@/lib/format";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortOrderRef(id: string) {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean.slice(-10) || id.slice(0, 10).toUpperCase();
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
  });
}

function openPrintWindow(html: string): boolean {
  const w = window.open("", "_blank", "width=900,height=720");
  if (!w) {
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      return false;
    }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        /* ignore */
      }
      setTimeout(() => iframe.remove(), 60_000);
    }, 250);
    return true;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function notePageHtml(order: ApiOrder, index: number, total: number): string {
  const ref = shortOrderRef(order.id);
  const code = barcodeValue(order.id);
  const barcode = barcodeSvgForPrint(code, { width: 280, height: 64, barWidth: 1.8 });
  const orderDate = formatDay(order.createdAt);
  const shipDate = formatDay(order.deliveryScheduledAt || order.createdAt);
  const customerName = order.customer?.name ?? "Walk-in";
  const phone = order.customer?.phone ?? "—";
  const address = order.deliveryAddress?.trim() || "Address not set";
  const notes = order.deliveryNotes?.trim() || "";
  const assignee = order.deliveryAssignee?.trim() || "—";

  const lines = order.items?.length
    ? order.items
        .map((line, i) => {
          const sku = line.product?.sku || line.product?.barcode || line.product?.id || line.id || "—";
          const name = line.product?.name ?? "Item";
          return `<tr>
            <td>${i + 1}</td>
            <td class="mono">${escapeHtml(String(sku))}</td>
            <td>${escapeHtml(name)}</td>
            <td class="right">${line.qty}</td>
            <td class="right">${escapeHtml(formatNPR(Number(line.unitPrice)))}</td>
            <td class="right">${escapeHtml(formatNPR(Number(line.lineTotal)))}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="muted">No line items on this order</td></tr>`;

  return `
  <section class="note">
    <header class="top">
      <div>
        <h1>Delivery note</h1>
        ${total > 1 ? `<p class="batch">Stop ${index + 1} of ${total}</p>` : ""}
      </div>
      <div class="brand">
        <strong>${escapeHtml(COMPANY.name)}</strong>
        <span>${escapeHtml(COMPANY.address)}</span>
        <span>${escapeHtml(COMPANY.phone)}</span>
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
        <p>Payment: ${escapeHtml(order.paymentStatus)} · ${escapeHtml(formatNPR(Number(order.amount)))}</p>
      </div>
      <div class="box">
        <h3>Source (from)</h3>
        <p><strong>${escapeHtml(COMPANY.name)}</strong></p>
        <p>${escapeHtml(COMPANY.category ?? "Cosmetics store")}</p>
        <p>${escapeHtml(COMPANY.address)}</p>
        <p>Tel: ${escapeHtml(COMPANY.phone)}</p>
        <p>${escapeHtml(COMPANY.email)}</p>
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
  .brand{text-align:right;font-size:12px;line-height:1.4;color:#333}
  .brand strong{display:block;font-size:14px;color:#111}
  .brand span{display:block}
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
  orders: ApiOrder[];
  /** Shown in document title only */
  rangeLabel?: string;
};

/** Print one delivery note per order (batch = multi-page). */
export function printDeliveryNotes(opts: DeliveryPrintOpts): boolean {
  const { orders, rangeLabel } = opts;
  if (!orders.length) return false;

  const pages = orders.map((o, i) => notePageHtml(o, i, orders.length)).join("");
  const title =
    orders.length === 1
      ? `Delivery note ${shortOrderRef(orders[0].id)}`
      : `Delivery notes (${orders.length})${rangeLabel ? ` — ${rangeLabel}` : ""}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>${STYLES}</style></head><body>
${pages}
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  return openPrintWindow(html);
}

/** @deprecated use printDeliveryNotes */
export function printDeliverySequence(opts: DeliveryPrintOpts): boolean {
  return printDeliveryNotes(opts);
}

/** Convenience: print a single order’s delivery note. */
export function printDeliveryNote(order: ApiOrder): boolean {
  return printDeliveryNotes({ orders: [order] });
}
