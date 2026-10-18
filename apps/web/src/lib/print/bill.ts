/**
 * Customer bill — 80 mm thermal receipt (QTY / DESC / AMT + bill-number
 * barcode) and the matching PDF. Built from server BillData (or the identical
 * offline equivalent). Rules (POS v2):
 *  - no "estimate" / "not a tax invoice" / "thank you" wording;
 *  - taxInvoice (VAT on + store PAN) → heading TAX INVOICE + "Tax invoice · PAN …";
 *  - VAT switched off → no VAT line at all;
 *  - footer = Settings → bill footer, printed only when set.
 */

import { jsPDF } from "jspdf";
import type { BillData, StoreProfile } from "@/lib/api/types";
import { paymentTitle } from "@/lib/pos/payments";
import { barcodeSvgForPrint } from "./barcode";
import { LOGO_DATA_URL, LOGO_HEIGHT, LOGO_WIDTH } from "./logo";
import { escapeHtml, printDocument } from "./print-document";

/** Seller block printed on the bill — from store settings (StoreProfile). */
export type BillCompany = {
  name: string;
  /** Printed under the name only when set and different from it. */
  legalName?: string;
  address: string;
  phone: string;
  pan: string;
  vat?: string;
  email?: string;
};

export function companyFromStore(store: Pick<StoreProfile, "name" | "legalName" | "address" | "phone" | "pan" | "vatNumber" | "email">): BillCompany {
  return {
    name: store.name,
    legalName: store.legalName,
    address: store.address,
    phone: store.phone,
    pan: store.pan,
    vat: store.vatNumber,
    email: store.email,
  };
}

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
  /** Global VAT switch at sale time; false → no VAT line. */
  vatEnabled: boolean;
  /** VAT % shown on the VAT line. */
  vatRate?: number;
  /** VAT on + store PAN → TAX INVOICE heading and "Tax invoice · PAN …" line. */
  taxInvoice?: boolean;
  /** Settings → bill footer ('' prints nothing). */
  footer?: string;
  /** Override print timestamp (defaults to now). */
  printedAt?: Date | string;
  /** Seller block (store settings). */
  company: BillCompany;
};

/** Map server (or offline-equivalent) BillData onto the bill layout. */
export function billOptsFromBillData(bill: BillData, extra: { channel?: string; company?: BillCompany } = {}): StoreBillOpts {
  const methods = [...new Set(bill.payments.map((p) => paymentTitle(p.method)))];
  return {
    orderId: bill.printableRef,
    customerName: bill.customer?.name || "Walk-in Customer",
    customerPhone: bill.customer?.phone ?? undefined,
    method: methods.length ? methods.join(" + ") : bill.due > 0 ? "Cash on delivery" : "—",
    channel: extra.channel ?? bill.channel,
    lines: bill.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    subtotal: bill.subtotal,
    vat: bill.vatAmount,
    total: bill.total,
    vatEnabled: bill.vatEnabled !== false && bill.vatAmount > 0,
    vatRate: bill.vatRate,
    taxInvoice: Boolean(bill.taxInvoice),
    footer: bill.footer ?? "",
    printedAt: bill.createdAt,
    company: extra.company ?? companyFromStore(bill.store),
  };
}

function npr(n: number) {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

function printTimestamp(opts: StoreBillOpts) {
  const d = opts.printedAt instanceof Date ? opts.printedAt : opts.printedAt ? new Date(opts.printedAt) : new Date();
  const timeZone = "Asia/Kathmandu";
  return {
    date: d.toLocaleDateString("en-NP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }),
    time: d.toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone }),
  };
}

function billBarcodeCode(orderId: string) {
  const clean = orderId.replace(/[^a-zA-Z0-9_-]/g, "");
  return (clean || orderId).slice(0, 24);
}

function footerLines(footer: string | undefined): string[] {
  return (footer ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

const showVat = (opts: StoreBillOpts) => opts.vatEnabled && opts.vat > 0;
const docTitle = (opts: StoreBillOpts) => (opts.taxInvoice ? "TAX INVOICE" : "BILL");

/** Thermal bill HTML (no script; printing is triggered by printDocument). */
export function billHtml(opts: StoreBillOpts): string {
  const COMPANY = opts.company;
  const vatLabel = `VAT ${opts.vatRate ?? 0}%`;
  const stamp = printTimestamp(opts);
  const code = billBarcodeCode(opts.orderId);
  const barcode = barcodeSvgForPrint(code, { width: 200, height: 48, barWidth: 1.5 });
  const title = docTitle(opts);
  const noteParts = [
    ...(opts.taxInvoice && COMPANY.pan ? [`Tax invoice · PAN ${escapeHtml(COMPANY.pan)}`] : []),
    ...footerLines(opts.footer).map(escapeHtml),
  ];
  const legal = COMPANY.legalName?.trim() && COMPANY.legalName.trim() !== COMPANY.name.trim() ? COMPANY.legalName.trim() : "";
  const taxIds = [COMPANY.pan ? `PAN ${escapeHtml(COMPANY.pan)}` : "", COMPANY.vat ? `VAT ${escapeHtml(COMPANY.vat)}` : ""].filter(Boolean).join(" · ");

  const rows = opts.lines
    .map(
      (l) =>
        `<tr>
          <td class="qty">${l.qty}</td>
          <td class="desc">${escapeHtml(l.name)}</td>
          <td class="amt">${npr(l.lineTotal)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><title>${escapeHtml(title)} ${escapeHtml(opts.orderId)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:14px 12px;color:#111;max-width:300px;margin:0 auto}
  h1{font-size:18px;margin:0 0 2px;text-align:center;font-weight:700;letter-spacing:.02em}
  .addr{margin:0;font-size:11px;text-align:center;color:#333;line-height:1.35}
  .doc{font-size:12px;font-weight:700;margin:10px 0 6px;text-align:center;letter-spacing:.08em}
  .row{display:flex;justify-content:space-between;font-size:11px;margin:2px 0}
  .meta{margin:8px 0;font-size:11px}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
  th{border-bottom:1px dashed #000;padding:4px 0;font-size:10px;letter-spacing:.04em;text-transform:uppercase}
  th.qty,td.qty{width:28px;text-align:left}
  th.desc,td.desc{text-align:left}
  th.amt,td.amt{text-align:right;white-space:nowrap}
  td{padding:5px 0;vertical-align:top}
  .tot{border-top:1px dashed #000;margin-top:8px;padding-top:8px}
  .tot .amt-big{display:flex;justify-content:space-between;font-weight:700;font-size:15px;margin:4px 0}
  .tot .small{display:flex;justify-content:space-between;font-size:11px;margin:2px 0;color:#333}
  .note{margin-top:12px;font-size:10px;text-align:center;line-height:1.35;color:#444}
  .bc{text-align:center;margin-top:14px}
  .bc svg{display:inline-block}
  .bc-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;margin-top:2px;letter-spacing:.04em}
  .logo{text-align:center;margin:0 0 6px}.logo img{display:inline-block;width:120px;height:auto}
  @media print{body{padding:0}}
  @page{size:80mm auto;margin:2mm}
</style></head><body>
  <div class="logo"><img src="${LOGO_DATA_URL}" alt="${escapeHtml(COMPANY.name)}" width="120" height="${Math.round((120 * LOGO_HEIGHT) / LOGO_WIDTH)}"/></div>
  <h1>${escapeHtml(COMPANY.name)}</h1>
${legal ? `  <p class="addr">${escapeHtml(legal)}</p>\n` : ""}  <p class="addr">${escapeHtml(COMPANY.address)}</p>
  <p class="addr">${escapeHtml(COMPANY.phone)}</p>
${taxIds ? `  <p class="addr">${taxIds}</p>\n` : ""}  <p class="doc">${title}</p>
  <div class="row"><span>${escapeHtml(stamp.date)}</span><span>${escapeHtml(stamp.time)}</span></div>
  <div class="meta">
    <div class="row"><span>Order ${escapeHtml(opts.orderId)}</span><span>${escapeHtml(opts.channel ?? "store")}</span></div>
    <div class="row"><span>${escapeHtml(opts.customerName)}</span><span>${escapeHtml(opts.method)}</span></div>
    ${opts.customerPhone ? `<div class="row"><span>Tel ${escapeHtml(opts.customerPhone)}</span><span></span></div>` : ""}
  </div>
  <table>
    <thead><tr><th class="qty">Qty</th><th class="desc">Desc</th><th class="amt">Amt</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    <div class="amt-big"><span>Amt</span><span>${npr(opts.total)}</span></div>
    <div class="small"><span>Subtotal</span><span>${npr(opts.subtotal)}</span></div>
    ${showVat(opts) ? `<div class="small"><span>${vatLabel}</span><span>${npr(opts.vat)}</span></div>` : ""}
    <div class="amt-big"><span>Balance</span><span>${npr(opts.total)}</span></div>
  </div>
${noteParts.length ? `  <p class="note">${noteParts.join("<br/>")}</p>\n` : ""}  <div class="bc">${barcode}<div class="bc-code">${escapeHtml(code)}</div></div>
</body></html>`;
}

/** Print the thermal bill (hidden print frame — works after an await and offline). */
export function printStoreBill(opts: StoreBillOpts) {
  return printDocument(billHtml({ ...opts, printedAt: opts.printedAt ?? new Date() }));
}

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
  if (showVat(opts)) line(`VAT ${opts.vatRate ?? 0}%`, npr(opts.vat));
  doc.setFont("helvetica", "bold");
  line("BALANCE", npr(opts.total));
  doc.setFont("helvetica", "normal");
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
