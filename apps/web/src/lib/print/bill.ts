/**
 * Customer bill — 80 mm thermal receipt (QTY / DESC / AMT + bill-number
 * barcode) and the matching PDF. Built from server BillData (or the identical
 * offline equivalent). Rules (POS v2):
 *  - no "estimate" / "not a tax invoice" / "thank you" wording;
 *  - taxInvoice (VAT on + store PAN) → heading TAX INVOICE + "Tax invoice · PAN …";
 *  - VAT switched off → no VAT line at all;
 *  - footer = Settings → bill footer, printed only when set.
 */

import type { BillData } from "@/lib/api/types";
import { paymentTitle } from "@/lib/pos/payments";
import { barcodeSvgForPrint } from "./barcode";
import { companyFromStore, type BillCompany } from "./company";
import { LOGO_DATA_URL, LOGO_HEIGHT, LOGO_WIDTH } from "./logo";
import { escapeHtml, printDocument } from "./print-document";

export type { BillCompany } from "./company";

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
  /** Printed only when not zero (old layouts had none of these). */
  discount?: number;
  deliveryCharge?: number;
  /** Cash handed over and change given back. */
  tendered?: number;
  change?: number;
  /** Still to pay (cash on delivery). */
  due?: number;
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
    discount: bill.discount,
    deliveryCharge: bill.deliveryCharge,
    tendered: bill.tendered,
    change: bill.change,
    due: bill.due,
    printedAt: bill.createdAt,
    company: extra.company ?? companyFromStore(bill.store),
  };
}

export function npr(n: number) {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

export function printTimestamp(opts: StoreBillOpts) {
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

export function footerLines(footer: string | undefined): string[] {
  return (footer ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Discount / delivery (before VAT) and cash given / change / due (after the balance), only when not zero. */
export function extraLines(opts: StoreBillOpts, where: "before" | "after"): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (where === "before") {
    if ((opts.discount ?? 0) > 0) out.push(["Discount", `-${npr(opts.discount ?? 0)}`]);
    if ((opts.deliveryCharge ?? 0) > 0) out.push(["Delivery", npr(opts.deliveryCharge ?? 0)]);
  } else {
    if ((opts.change ?? 0) > 0) {
      out.push(["Cash given", npr(opts.tendered ?? 0)]);
      out.push(["Change", npr(opts.change ?? 0)]);
    }
    if ((opts.due ?? 0) > 0) out.push(["To pay on delivery", npr(opts.due ?? 0)]);
  }
  return out;
}

export const showVat = (opts: StoreBillOpts) => opts.vatEnabled && opts.vat > 0;
export const docTitle = (opts: StoreBillOpts) => (opts.taxInvoice ? "TAX INVOICE" : "BILL");

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
${extraLines(opts, "before").map((l) => `    <div class="small"><span>${escapeHtml(l[0])}</span><span>${l[1]}</span></div>\n`).join("")}    ${showVat(opts) ? `<div class="small"><span>${vatLabel}</span><span>${npr(opts.vat)}</span></div>` : ""}
    <div class="amt-big"><span>Balance</span><span>${npr(opts.total)}</span></div>
${extraLines(opts, "after").map((l) => `    <div class="small"><span>${escapeHtml(l[0])}</span><span>${l[1]}</span></div>\n`).join("")}  </div>
${noteParts.length ? `  <p class="note">${noteParts.join("<br/>")}</p>\n` : ""}  <div class="bc">${barcode}<div class="bc-code">${escapeHtml(code)}</div></div>
</body></html>`;
}

/** Print the thermal bill (hidden print frame — works after an await and offline). */
export function printStoreBill(opts: StoreBillOpts) {
  return printDocument(billHtml({ ...opts, printedAt: opts.printedAt ?? new Date() }));
}
