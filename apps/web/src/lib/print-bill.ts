/** Glamo POS estimate bill — thermal print + PDF download. */

import { jsPDF } from "jspdf";

export type BillLine = {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type StoreBillOpts = {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  method: string;
  channel?: string;
  lines: BillLine[];
  subtotal: number;
  vat: number;
  total: number;
  vatEnabled: boolean;
  /** Override print timestamp (defaults to now). */
  printedAt?: Date | string;
};

function npr(n: number) {
  return `Rs ${Math.round(n).toLocaleString("en-NP")}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printTimestamp(opts: StoreBillOpts) {
  const d =
    opts.printedAt instanceof Date
      ? opts.printedAt
      : opts.printedAt
        ? new Date(opts.printedAt)
        : new Date();
  return d.toLocaleString("en-NP", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/** Open thermal-style estimate bill and trigger browser print (Save as PDF works too). */
export function printStoreBill(opts: StoreBillOpts) {
  const printedAt = printTimestamp(opts);
  const rows = opts.lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:4px 0;text-align:left">${escapeHtml(l.name)}</td>
          <td style="padding:4px 0;text-align:center">${l.qty}</td>
          <td style="padding:4px 0;text-align:right">${npr(l.unitPrice)}</td>
          <td style="padding:4px 0;text-align:right">${npr(l.lineTotal)}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><head><title>Estimate ${escapeHtml(opts.orderId.slice(0, 8))}</title>
<style>
  body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:16px;color:#111;max-width:320px;margin:0 auto}
  h1{font-size:16px;margin:0 0 4px;text-align:center}
  .doc{font-size:13px;font-weight:700;margin:6px 0 2px;text-align:center;letter-spacing:.04em}
  p{margin:2px 0;font-size:12px;text-align:center}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
  th{border-bottom:1px solid #000;padding:4px 0;text-align:left}
  .tot{border-top:1px dashed #000;margin-top:8px;padding-top:8px;font-size:13px}
  .tot div{display:flex;justify-content:space-between;margin:2px 0}
  .big{font-weight:700;font-size:15px}
  .note{margin-top:14px;font-size:10px;text-align:center;line-height:1.35}
  @media print{body{padding:0}}
</style></head><body>
  <h1>Glamo Nepal</h1>
  <p>Teku / Kathmandu</p>
  <p class="doc">ESTIMATE BILL</p>
  <p>Print time: ${escapeHtml(printedAt)}</p>
  <p>Ref: ${escapeHtml(opts.orderId.slice(0, 12))}…</p>
  ${opts.channel ? `<p>Channel: ${escapeHtml(opts.channel)}</p>` : ""}
  <p>Customer: ${escapeHtml(opts.customerName)}</p>
  ${opts.customerPhone ? `<p>Phone: ${escapeHtml(opts.customerPhone)}</p>` : ""}
  <p>Pay: ${escapeHtml(opts.method)}</p>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    <div><span>Subtotal</span><span>${npr(opts.subtotal)}</span></div>
    ${opts.vatEnabled && opts.vat > 0 ? `<div><span>VAT</span><span>${npr(opts.vat)}</span></div>` : ""}
    <div class="big"><span>EST. TOTAL</span><span>${npr(opts.total)}</span></div>
  </div>
  <p class="note">This is an estimate bill — not a tax invoice.<br/>Thank you</p>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;

  // Avoid noopener — some browsers then block document.write / print.
  const w = window.open("", "_blank", "width=400,height=640");
  if (!w) {
    // Iframe fallback when popups blocked
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
      setTimeout(() => iframe.remove(), 800);
    }, 200);
    return true;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

/** Download a PDF estimate bill for the sale. */
export function downloadStoreBillPdf(opts: StoreBillOpts) {
  const printedAt = printTimestamp(opts);
  const doc = new jsPDF({ unit: "mm", format: [80, 210] });
  const w = 80;
  let y = 8;
  const center = (text: string, size = 10) => {
    doc.setFontSize(size);
    doc.text(text, w / 2, y, { align: "center" });
    y += size * 0.45 + 1.5;
  };
  const line = (left: string, right: string) => {
    doc.setFontSize(8);
    doc.text(left, 4, y);
    doc.text(right, w - 4, y, { align: "right" });
    y += 4;
  };

  doc.setFont("helvetica", "bold");
  center("Glamo Nepal", 12);
  doc.setFont("helvetica", "normal");
  center("Teku / Kathmandu", 8);
  doc.setFont("helvetica", "bold");
  center("ESTIMATE BILL", 10);
  doc.setFont("helvetica", "normal");
  center(`Print time: ${printedAt}`, 7);
  y += 1;
  doc.setDrawColor(0);
  doc.line(4, y, w - 4, y);
  y += 5;

  line("Ref", opts.orderId.slice(0, 12));
  if (opts.channel) line("Channel", opts.channel);
  line("Customer", opts.customerName.slice(0, 22));
  if (opts.customerPhone) line("Phone", opts.customerPhone);
  line("Pay", opts.method);
  y += 1;
  doc.line(4, y, w - 4, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  line("Item", "Amt");
  doc.setFont("helvetica", "normal");
  for (const l of opts.lines) {
    const name = l.name.length > 18 ? `${l.name.slice(0, 17)}…` : l.name;
    line(`${name} x${l.qty}`, npr(l.lineTotal));
    if (y > 185) {
      doc.addPage([80, 210]);
      y = 8;
    }
  }
  y += 1;
  doc.line(4, y, w - 4, y);
  y += 5;
  line("Subtotal", npr(opts.subtotal));
  if (opts.vatEnabled && opts.vat > 0) line("VAT", npr(opts.vat));
  doc.setFont("helvetica", "bold");
  line("EST. TOTAL", npr(opts.total));
  doc.setFont("helvetica", "normal");
  y += 4;
  center("Estimate — not a tax invoice", 7);
  center("Thank you", 9);

  doc.save(`glamo-estimate-${opts.orderId.slice(0, 8)}.pdf`);
  return true;
}

/** Print + download PDF estimate. */
export function issueStoreBill(opts: StoreBillOpts) {
  const stamped = { ...opts, printedAt: opts.printedAt ?? new Date() };
  downloadStoreBillPdf(stamped);
  printStoreBill(stamped);
}

/** Large QR payload for customer to scan (amount + shop). Replace with Fonepay/eSewa payload later. */
export function paymentQrImageUrl(total: number) {
  const payload = `GLAMO|NPR|${Math.round(total)}|GlamoNepal`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(payload)}`;
}
