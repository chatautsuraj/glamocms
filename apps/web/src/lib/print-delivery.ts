/** Print a delivery run sheet for a filtered sequence of orders. */

import type { ApiOrder } from "@/lib/commerce-client";
import { formatNPR } from "@/lib/format";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printTime(d = new Date()) {
  return d.toLocaleString("en-NP", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function orderLines(order: ApiOrder): string {
  if (!order.items?.length) return "<em>No line items</em>";
  return order.items
    .map((line) => {
      const name = line.product?.name ?? "Item";
      return `${escapeHtml(name)} × ${line.qty}`;
    })
    .join("<br/>");
}

export type DeliveryPrintOpts = {
  orders: ApiOrder[];
  /** Shown under the title, e.g. "Today" or "2026-09-01 → 2026-09-18" */
  rangeLabel: string;
};

/**
 * Open one printable document with every filtered order’s delivery details,
 * in list order, for the driver/run sheet.
 */
export function printDeliverySequence(opts: DeliveryPrintOpts): boolean {
  const { orders, rangeLabel } = opts;
  if (!orders.length) return false;

  const stops = orders
    .map((o, i) => {
      const name = o.customer?.name ?? "Walk-in";
      const phone = o.customer?.phone ?? "—";
      const address = o.deliveryAddress?.trim() || "—";
      const assignee = o.deliveryAssignee?.trim() || "—";
      const notes = o.deliveryNotes?.trim() || "—";
      const scheduled = o.deliveryScheduledAt
        ? new Date(o.deliveryScheduledAt).toLocaleDateString("en-NP")
        : "—";
      return `
      <section class="stop">
        <div class="stop-head">
          <span class="num">#${i + 1}</span>
          <span class="ref">${escapeHtml(o.id.slice(0, 12))}…</span>
          <span class="ch">${escapeHtml(o.channel)}</span>
          <span class="st">${escapeHtml(o.fulfillmentStatus)}</span>
        </div>
        <div class="grid">
          <div><strong>Customer</strong><br/>${escapeHtml(name)}</div>
          <div><strong>Phone</strong><br/>${escapeHtml(phone)}</div>
          <div class="span2"><strong>Address</strong><br/>${escapeHtml(address)}</div>
          <div><strong>Assignee</strong><br/>${escapeHtml(assignee)}</div>
          <div><strong>Scheduled</strong><br/>${escapeHtml(scheduled)}</div>
          <div class="span2"><strong>Notes</strong><br/>${escapeHtml(notes)}</div>
          <div class="span2"><strong>Items</strong><br/>${orderLines(o)}</div>
          <div><strong>Payment</strong><br/>${escapeHtml(o.paymentStatus)}</div>
          <div><strong>Amount</strong><br/>${escapeHtml(formatNPR(Number(o.amount)))}</div>
        </div>
      </section>`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><title>Delivery run — ${escapeHtml(rangeLabel)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:20px;color:#111;max-width:800px;margin:0 auto}
  h1{font-size:18px;margin:0 0 4px}
  .meta{font-size:12px;color:#444;margin:0 0 16px}
  .stop{border:1px solid #222;border-radius:8px;padding:12px 14px;margin:0 0 12px;page-break-inside:avoid}
  .stop-head{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-bottom:10px;font-size:12px}
  .num{font-weight:700;font-size:14px}
  .ref{font-family:ui-monospace,Menlo,Consolas,monospace}
  .ch,.st{text-transform:uppercase;letter-spacing:.03em;font-size:10px;border:1px solid #999;border-radius:4px;padding:1px 6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;line-height:1.35}
  .span2{grid-column:1 / -1}
  .foot{margin-top:18px;font-size:11px;color:#555;border-top:1px dashed #999;padding-top:8px}
  @media print{
    body{padding:0}
    .stop{break-inside:avoid}
  }
</style></head><body>
  <h1>Glamo Nepal — Delivery run</h1>
  <p class="meta">
    Filter: ${escapeHtml(rangeLabel)} · ${orders.length} stop(s) · Printed ${escapeHtml(printTime())}
  </p>
  ${stops}
  <p class="foot">Sign / received: ______________________ &nbsp;&nbsp; Driver: ______________________</p>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;

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
    setTimeout(() => iframe.remove(), 60_000);
    return true;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
