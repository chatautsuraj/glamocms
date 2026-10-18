/** Glamo POS estimate bill — thermal receipt style (QTY / DESC / AMT + barcode). */

import { jsPDF } from "jspdf";
import type { BillData, StoreProfile } from "@/lib/api/types";
import { barcodeSvgForPrint } from "@/lib/print-barcodes";
import { LOGO_DATA_URL, LOGO_HEIGHT, LOGO_WIDTH } from "@/lib/print-logo";

/** Company block printed on the bill — comes from store settings (StoreProfile). */
export type BillCompany = {
  name: string;
  address: string;
  phone: string;
  pan: string;
  vat?: string;
  email?: string;
  category?: string;
};

export function companyFromStore(store: Pick<StoreProfile, "name" | "address" | "phone" | "pan" | "vatNumber" | "email">): BillCompany {
  return {
    name: store.name,
    address: store.address,
    phone: store.phone,
    pan: store.pan,
    vat: store.vatNumber,
    email: store.email,
    category: "Cosmetics store",
  };
}

function orderNumberFileSlug(orderId: string): string {
  return String(orderId).replace(/[^a-zA-Z0-9_-]/g, "") || "order";
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
  vatEnabled: boolean;
  /** Override print timestamp (defaults to now). */
  printedAt?: Date | string;
  /** Tax invoice (Nepal VAT / PAN) vs estimate bill */
  invoiceType?: "estimate" | "tax";
  buyerPan?: string;
  /** Seller company block (store settings). */
  company: BillCompany;
  /** VAT % shown on the VAT line (default 13). */
  vatRate?: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  FONEPAY_QR: "Fonepay QR",
  KHALTI: "Khalti",
  ESEWA: "eSewa",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Khata",
  CASH_ON_DELIVERY: "COD",
};

/** Map server (or offline-equivalent) BillData onto the bill layout. */
export function billOptsFromBillData(
  bill: BillData,
  extra: { channel?: string; invoiceType?: "estimate" | "tax"; buyerPan?: string; company?: BillCompany } = {},
): StoreBillOpts {
  const methods = [...new Set(bill.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method))];
  return {
    orderId: bill.printableRef,
    customerName: bill.customer?.name || "Walk-in Customer",
    customerPhone: bill.customer?.phone ?? undefined,
    method: methods.length ? methods.join(" + ") : bill.due > 0 ? "COD" : "—",
    channel: extra.channel ?? bill.channel,
    lines: bill.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    subtotal: bill.subtotal,
    vat: bill.vatAmount,
    total: bill.total,
    vatEnabled: bill.vatAmount > 0,
    printedAt: bill.createdAt,
    invoiceType: extra.invoiceType,
    buyerPan: extra.buyerPan,
    company: extra.company ?? companyFromStore(bill.store),
    vatRate: bill.vatRate,
  };
}

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
  return {
    date: d.toLocaleDateString("en-NP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: d.toLocaleTimeString("en-NP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    full: d.toLocaleString("en-NP", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };
}

function billBarcodeCode(orderId: string) {
  const clean = orderId.replace(/[^a-zA-Z0-9_-]/g, "");
  return (clean || orderId).slice(0, 24);
}

/** Open thermal-style estimate or tax invoice and trigger browser print. */
export function printStoreBill(opts: StoreBillOpts) {
  const COMPANY = opts.company;
  const vatLabel = `VAT ${opts.vatRate ?? 13}%`;
  const stamp = printTimestamp(opts);
  const code = billBarcodeCode(opts.orderId);
  const barcode = barcodeSvgForPrint(code, { width: 200, height: 48, barWidth: 1.5 });
  const isTax = opts.invoiceType === "tax";
  const docTitle = isTax ? "TAX INVOICE" : "ESTIMATE BILL";
  const note = isTax
    ? `Tax invoice · Seller PAN ${COMPANY.pan}${opts.buyerPan ? ` · Buyer PAN ${escapeHtml(opts.buyerPan)}` : ""}<br/>VAT as applicable (IRD / Nepal). Thank you`
    : "This is an estimate bill — not a tax invoice.<br/>Thank you";

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

  const html = `<!doctype html>
<html><head><title>${escapeHtml(docTitle)} ${escapeHtml(opts.orderId)}</title>
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
  <p class="addr">${escapeHtml(COMPANY.category ?? "Cosmetics store")}</p>
  <p class="addr">${escapeHtml(COMPANY.address)}</p>
  <p class="addr">${escapeHtml(COMPANY.phone)}</p>
  <p class="addr">PAN ${escapeHtml(COMPANY.pan)}${COMPANY.vat ? ` · VAT ${escapeHtml(COMPANY.vat)}` : ""}</p>
  <p class="doc">${docTitle}</p>
  <div class="row"><span>${escapeHtml(stamp.date)}</span><span>${escapeHtml(stamp.time)}</span></div>
  <div class="meta">
    <div class="row"><span>Order ${escapeHtml(opts.orderId)}</span><span>${escapeHtml(opts.channel ?? "store")}</span></div>
    <div class="row"><span>${escapeHtml(opts.customerName)}</span><span>${escapeHtml(opts.method)}</span></div>
    ${opts.customerPhone ? `<div class="row"><span>Tel ${escapeHtml(opts.customerPhone)}</span><span></span></div>` : ""}
    ${isTax && opts.buyerPan ? `<div class="row"><span>Buyer PAN</span><span>${escapeHtml(opts.buyerPan)}</span></div>` : ""}
  </div>
  <table>
    <thead><tr><th class="qty">Qty</th><th class="desc">Desc</th><th class="amt">Amt</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    <div class="amt-big"><span>Amt</span><span>${npr(opts.total)}</span></div>
    <div class="small"><span>Subtotal</span><span>${npr(opts.subtotal)}</span></div>
    ${(isTax || opts.vatEnabled) && opts.vat > 0 ? `<div class="small"><span>${vatLabel}</span><span>${npr(opts.vat)}</span></div>` : ""}
    <div class="amt-big"><span>Balance</span><span>${npr(opts.total)}</span></div>
  </div>
  <p class="note">${note}</p>
  <div class="bc">${barcode}<div class="bc-code">${escapeHtml(code)}</div></div>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open("", "_blank", "width=400,height=640");
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
  center(COMPANY.category ?? "Cosmetics store", 7);
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
  center("ESTIMATE BILL", 10);
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
  if ((opts.invoiceType === "tax" || opts.vatEnabled) && opts.vat > 0) line(`VAT ${opts.vatRate ?? 13}%`, npr(opts.vat));
  doc.setFont("helvetica", "bold");
  line("BALANCE", npr(opts.total));
  doc.setFont("helvetica", "normal");
  y += 4;
  if (opts.invoiceType === "tax") {
    center(`PAN ${COMPANY.pan}`, 7);
    if (opts.buyerPan) center(`Buyer PAN ${opts.buyerPan}`, 7);
    center("Tax invoice", 7);
  } else {
    center("Estimate — not a tax invoice", 7);
  }
  center("Thank you", 9);

  doc.save(
    `glamo-${opts.invoiceType === "tax" ? "tax" : "estimate"}-${orderNumberFileSlug(opts.orderId)}.pdf`,
  );
  return true;
}

/** Print thermal receipt. PDF download is opt-in (jspdf freezes the counter). */
export function issueStoreBill(opts: StoreBillOpts & { downloadPdf?: boolean }) {
  const stamped = { ...opts, printedAt: opts.printedAt ?? new Date() };
  printStoreBill(stamped);
  if (!opts.downloadPdf) return;
  const schedule =
    typeof window !== "undefined" && "requestIdleCallback" in window
      ? (cb: () => void) =>
          (
            window as Window & {
              requestIdleCallback: (fn: () => void, opts?: { timeout: number }) => number;
            }
          ).requestIdleCallback(cb, { timeout: 2000 })
      : (cb: () => void) => window.setTimeout(cb, 250);
  schedule(() => {
    try {
      downloadStoreBillPdf(stamped);
    } catch {
      /* print already issued */
    }
  });
}
