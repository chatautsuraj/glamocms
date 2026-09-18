/** Glamo POS bill — thermal print + PDF download. */

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

/** Open thermal-style bill and trigger browser print (Save as PDF works too). */
export function printStoreBill(opts: StoreBillOpts) {
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
<html><head><title>Bill ${escapeHtml(opts.orderId.slice(0, 8))}</title>
<style>
  body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:16px;color:#111;max-width:320px;margin:0 auto}
  h1{font-size:16px;margin:0 0 4px;text-align:center}
  p{margin:2px 0;font-size:12px;text-align:center}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
  th{border-bottom:1px solid #000;padding:4px 0;text-align:left}
  .tot{border-top:1px dashed #000;margin-top:8px;padding-top:8px;font-size:13px}
  .tot div{display:flex;justify-content:space-between;margin:2px 0}
  .big{font-weight:700;font-size:15px}
  @media print{body{padding:0}}
</style></head><body>
  <h1>Glamo Nepal</h1>
  <p>Teku / Kathmandu</p>
  <p>${new Date().toLocaleString()}</p>
  <p>Order: ${escapeHtml(opts.orderId.slice(0, 12))}…</p>
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
    <div class="big"><span>TOTAL</span><span>${npr(opts.total)}</span></div>
  </div>
  <p style="margin-top:16px">Thank you</p>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=400,height=640");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/** Download a PDF receipt for the sale. */
export function downloadStoreBillPdf(opts: StoreBillOpts) {
  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
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
  center(new Date().toLocaleString(), 7);
  y += 1;
  doc.setDrawColor(0);
  doc.line(4, y, w - 4, y);
  y += 5;

  line("Order", opts.orderId.slice(0, 12));
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
    if (y > 180) {
      doc.addPage([80, 200]);
      y = 8;
    }
  }
  y += 1;
  doc.line(4, y, w - 4, y);
  y += 5;
  line("Subtotal", npr(opts.subtotal));
  if (opts.vatEnabled && opts.vat > 0) line("VAT", npr(opts.vat));
  doc.setFont("helvetica", "bold");
  line("TOTAL", npr(opts.total));
  doc.setFont("helvetica", "normal");
  y += 4;
  center("Thank you", 9);

  doc.save(`glamo-bill-${opts.orderId.slice(0, 8)}.pdf`);
  return true;
}

/** Print + download PDF. */
export function issueStoreBill(opts: StoreBillOpts) {
  downloadStoreBillPdf(opts);
  printStoreBill(opts);
}

/** Large QR payload for customer to scan (amount + shop). Replace with Fonepay/eSewa payload later. */
export function paymentQrImageUrl(total: number) {
  const payload = `GLAMO|NPR|${Math.round(total)}|GlamoNepal`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(payload)}`;
}
