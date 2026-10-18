/**
 * 80 mm PDF bill (jsPDF). Kept out of bill.ts so jsPDF (~200 kB) loads only
 * when someone presses "Download PDF".
 */
import { jsPDF } from "jspdf";
import { docTitle, extraLines, footerLines, npr, printTimestamp, showVat, type StoreBillOpts } from "./bill";
import { LOGO_DATA_URL, LOGO_HEIGHT, LOGO_WIDTH } from "./logo";

function fileSlug(ref: string): string {
  return String(ref).replace(/[^a-zA-Z0-9_-]/g, "") || "bill";
}

/** Build the 80 mm PDF bill (jsPDF document, not yet saved). */
export function billPdf(opts: StoreBillOpts): jsPDF {
  const COMPANY = opts.company;
  const stamp = printTimestamp(opts);
  const doc = new jsPDF({ unit: "mm", format: [80, 210] });
  const w = 80;
  let y = 8;
  // Logo top-left (does not shift the text layout).
  doc.addImage(LOGO_DATA_URL, "PNG", 4, 2, 15, (15 * LOGO_HEIGHT) / LOGO_WIDTH);
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
  center(COMPANY.name, 12);
  doc.setFont("helvetica", "normal");
  const legal = COMPANY.legalName?.trim();
  if (legal && legal !== COMPANY.name.trim()) center(legal, 7);
  // Split long address for 80mm thermal width
  const addr = COMPANY.address;
  if (addr.length > 32) {
    const cut = addr.lastIndexOf(",", 32);
    const i = cut > 10 ? cut + 1 : 32;
    center(addr.slice(0, i).trim(), 7);
    center(addr.slice(i).trim(), 7);
  } else {
    center(addr, 7);
  }
  center(COMPANY.phone, 8);
  doc.setFont("helvetica", "bold");
  center(docTitle(opts), 10);
  doc.setFont("helvetica", "normal");
  center(`${stamp.date}  ${stamp.time}`, 7);
  y += 1;
  doc.setDrawColor(0);
  doc.line(4, y, w - 4, y);
  y += 5;

  line("Order", opts.orderId);
  if (opts.channel) line("Channel", opts.channel);
  line("Customer", opts.customerName.slice(0, 22));
  if (opts.customerPhone) line("Phone", opts.customerPhone);
  line("Pay", opts.method);
  y += 1;
  doc.line(4, y, w - 4, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  line("Qty  Desc", "Amt");
  doc.setFont("helvetica", "normal");
  for (const l of opts.lines) {
    const name = l.name.length > 16 ? `${l.name.slice(0, 15)}…` : l.name;
    line(`${l.qty}  ${name}`, npr(l.lineTotal));
    if (y > 185) {
      doc.addPage([80, 210]);
      y = 8;
    }
  }
  y += 1;
  doc.line(4, y, w - 4, y);
  y += 5;
  line("Subtotal", npr(opts.subtotal));
  for (const [label, value] of extraLines(opts, "before")) line(label, value);
  if (showVat(opts)) line(`VAT ${opts.vatRate ?? 0}%`, npr(opts.vat));
  doc.setFont("helvetica", "bold");
  line("BALANCE", npr(opts.total));
  doc.setFont("helvetica", "normal");
  for (const [label, value] of extraLines(opts, "after")) line(label, value);
  y += 4;
  if (opts.taxInvoice && COMPANY.pan) center(`Tax invoice · PAN ${COMPANY.pan}`, 7);
  for (const f of footerLines(opts.footer)) center(f.length > 44 ? `${f.slice(0, 43)}…` : f, 7);
  return doc;
}

/** Download the PDF bill for the sale. */
export function downloadStoreBillPdf(opts: StoreBillOpts) {
  billPdf(opts).save(`bill-${fileSlug(opts.orderId)}.pdf`);
  return true;
}
