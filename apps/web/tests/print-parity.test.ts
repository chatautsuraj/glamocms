/**
 * Bill / delivery-note parity: GLAMO POS print output must keep the layout
 * captured from the original print code (tests/fixtures/print-old.json).
 *
 * Intended v2 changes, applied to the old fixture before comparing (so every
 * other byte must still match):
 *  1. No "ESTIMATE BILL" heading: the heading is "BILL", or "TAX INVOICE"
 *     when BillData.taxInvoice (VAT on + store PAN).
 *  2. The "This is an estimate bill — not a tax invoice. / Thank you" note
 *     (and the PDF "Estimate — not a tax invoice" / "Thank you" lines) are
 *     gone. The note now prints only "Tax invoice · PAN …" (tax invoices)
 *     and/or the Settings bill footer; with neither, no note at all.
 *  3. The hard-coded "Cosmetics store" tagline is gone from bills and delivery
 *     notes (store data comes from Settings: the legal name prints there when
 *     it differs from the store name).
 *  4. Buyer PAN is no longer printed (no API field for it).
 *  5. The inline print script is gone: bills/notes print through a hidden
 *     print frame (lib/print/print-document.ts), which prints exactly once.
 *  6. The logo is the embedded GLAMO PNG (unchanged since v1).
 */
import { capturePdf, pdfTexts, type PdfOp } from "./helpers/print-capture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { billHtml, billOptsFromBillData } from "../src/lib/print/bill";
import { companyFromStore, type BillCompany } from "../src/lib/print/company";
import { billPdf } from "../src/lib/print/bill-pdf";
import { deliveryNotesHtml } from "../src/lib/print/delivery-note";
import type { BillData, PosOrder } from "../src/lib/api/types";
import {
  OLD_COMPANY, OLD_COMPANY_AS_BILL, REAL_STORE, SAMPLE_BILL_DATA, SAMPLE_BILL_OPTS, SAMPLE_POS_ORDER, SAMPLE_TAX_OPTS,
} from "./fixtures/print-samples";

const old = JSON.parse(readFileSync(new URL("./fixtures/print-old.json", import.meta.url), "utf8")) as {
  billHtml: string; taxBillHtml: string; billPdfOps: PdfOp[]; taxBillPdfOps: PdfOp[]; deliveryHtml: string;
};

/** Remove the embedded logo element + its CSS rule from bill HTML. */
function stripBillLogo(html: string) {
  return html
    .replace(/\n {2}\.logo\{[^\n]*\}\n/, "\n")
    .replace(/\n {2}<div class="logo"><img src="data:image\/png;base64,[^"]+" alt="[^"]*" width="\d+" height="\d+"\/><\/div>/, "");
}

const SCRIPT_LINE = "  <script>window.onload=function(){window.print();}</script>\n";

/** Old fixture HTML → what v2 must print (changes 1–5 above). */
function v2BillFromOld(html: string, kind: "plain" | "tax") {
  let out = html
    .replace(SCRIPT_LINE, "")
    .replace('  <p class="addr">Cosmetics store</p>\n', "")
    .replace(/\n {4}(<div class="row"><span>Buyer PAN<\/span><span>[^<]*<\/span><\/div>)?\n {2}<\/div>/, "\n  </div>");
  if (kind === "plain") {
    out = out
      .replace("<title>ESTIMATE BILL ", "<title>BILL ")
      .replace('<p class="doc">ESTIMATE BILL</p>', '<p class="doc">BILL</p>')
      .replace('  <p class="note">This is an estimate bill — not a tax invoice.<br/>Thank you</p>\n', "");
  } else {
    out = out.replace(/<p class="note">Tax invoice · Seller PAN (\d+)[^<]*<br\/>VAT as applicable \(IRD \/ Nepal\)\. Thank you<\/p>/, '<p class="note">Tax invoice · PAN $1</p>');
  }
  return out;
}

/** Old PDF text sequence → v2 text sequence. */
function v2PdfTextsFromOld(texts: string[], kind: "plain" | "tax") {
  // (v1's PDF printed "ESTIMATE BILL" even on tax invoices; v2 says TAX INVOICE.)
  const heading = kind === "tax" ? "TAX INVOICE" : "BILL";
  const out = texts.filter((t) => t !== "Cosmetics store" && t !== "Thank you" && t !== "Estimate — not a tax invoice").map((t) => (t === "ESTIMATE BILL" ? heading : t));
  if (kind === "tax") {
    const at = out.findIndex((t) => /^PAN \d+$/.test(t));
    const pan = out[at].slice(4);
    out.splice(at, 3, `Tax invoice · PAN ${pan}`); // "PAN x", "Buyer PAN y", "Tax invoice"
  }
  return out;
}

const withoutLogoOps = (ops: PdfOp[]) => ops.filter(([name]) => name !== "addImage");

test("bill HTML keeps the old layout with only the documented v2 changes", () => {
  const html = billHtml({ ...SAMPLE_BILL_OPTS, company: OLD_COMPANY_AS_BILL });
  assert.match(html, /<div class="logo"><img src="data:image\/png;base64,/, "logo embedded as data URL");
  assert.equal(stripBillLogo(html), v2BillFromOld(old.billHtml, "plain"));
  const tax = billHtml({ ...SAMPLE_TAX_OPTS, company: OLD_COMPANY_AS_BILL });
  assert.equal(stripBillLogo(tax), v2BillFromOld(old.taxBillHtml, "tax"));
});

test("bill PDF draws the same text as before minus the estimate wording", () => {
  const ops = capturePdf(() => billPdf({ ...SAMPLE_BILL_OPTS, company: OLD_COMPANY_AS_BILL }).save("x.pdf"));
  const images = ops.filter(([n]) => n === "addImage");
  assert.equal(images.length, 1);
  assert.match(String(images[0][1]), /^data:image\/png;base64,/);
  assert.deepEqual(pdfTexts(ops), v2PdfTextsFromOld(pdfTexts(old.billPdfOps), "plain"));
  assert.equal(withoutLogoOps(ops).filter(([n]) => n === "line").length, old.billPdfOps.filter(([n]) => n === "line").length, "same rules");
  const tax = capturePdf(() => billPdf({ ...SAMPLE_TAX_OPTS, company: OLD_COMPANY_AS_BILL }).save("x.pdf"));
  assert.deepEqual(pdfTexts(tax), v2PdfTextsFromOld(pdfTexts(old.taxBillPdfOps), "tax"));
});

/** Replace each company field value with a token so only layout is compared. */
function tokeniseCompany(text: string, c: BillCompany) {
  const pairs: Array<[string, string]> = [
    [c.address, "{ADDRESS}"], [c.email ?? "", "{EMAIL}"], [c.phone, "{PHONE}"], [c.legalName ?? "", "{LEGAL}"], [c.name, "{NAME}"], [c.pan, "{PAN}"], [c.vat ?? "", "{VAT}"],
  ];
  let out = text;
  for (const [value, token] of pairs.filter(([v]) => v).sort((a, b) => b[0].length - a[0].length)) out = out.split(value).join(token);
  return out;
}

test("real store settings change only the company fields (legal name replaces the old tagline)", () => {
  const store = companyFromStore(REAL_STORE);
  const html = billHtml({ ...SAMPLE_BILL_OPTS, company: store });
  assert.ok(html.includes("S.S Chowk, Madhyapur Thimi, Bagmati"));
  assert.ok(html.includes("+977 9818212188"));
  assert.ok(!html.includes(OLD_COMPANY.phone));
  const expected = tokeniseCompany(v2BillFromOld(old.billHtml, "plain"), OLD_COMPANY_AS_BILL)
    .replace('  <p class="addr">{ADDRESS}</p>', '  <p class="addr">{LEGAL}</p>\n  <p class="addr">{ADDRESS}</p>');
  assert.equal(tokeniseCompany(stripBillLogo(html), store), expected);
});

test("BillData from the server maps onto the bill lines", () => {
  const opts = billOptsFromBillData(SAMPLE_BILL_DATA as BillData);
  assert.equal(opts.orderId, "GLM-261018-0042");
  assert.deepEqual(opts.lines, SAMPLE_BILL_OPTS.lines);
  assert.equal(opts.method, "Cash + Fonepay");
  assert.equal(opts.total, 2897);
  assert.equal(opts.vat, 333);
  assert.equal(opts.vatEnabled, true);
  assert.equal(opts.company.address, REAL_STORE.address);
  const html = billHtml({ ...opts, method: SAMPLE_BILL_OPTS.method, company: OLD_COMPANY_AS_BILL });
  assert.equal(stripBillLogo(html), v2BillFromOld(old.billHtml, "plain"), "BillData path renders the identical layout");
});

const OLD_LOGO_SVG = /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 120 120"[\s\S]*?<\/svg>/g;
const NEW_LOGO_IMG = /<img src="data:image\/png;base64,[^"]+" alt="[^"]*" width="\d+" height="\d+"\/>/g;
/** Old note minus the print script and the hard-coded tagline (or with the legal name in its place). */
const oldDelivery = (legal = "") =>
  old.deliveryHtml
    .replace(OLD_LOGO_SVG, "[LOGO]")
    .replace("<script>window.onload=function(){window.print();}</script>\n", "")
    .replace("          <span>Cosmetics store</span>\n", legal ? `          <span>${legal}</span>\n` : "")
    .replace("            <p>Cosmetics store</p>\n", legal ? `            <p>${legal}</p>\n` : "");

test("delivery note matches the old layout apart from the logo and the print script", () => {
  const html = deliveryNotesHtml({ orders: [SAMPLE_POS_ORDER as unknown as PosOrder], company: OLD_COMPANY_AS_BILL });
  assert.equal((html.match(NEW_LOGO_IMG) ?? []).length, 2, "both logo spots use the PNG data URL");
  assert.ok(!html.includes("<script"), "no inline print script");
  assert.equal(html.replace(NEW_LOGO_IMG, "[LOGO]"), oldDelivery());
});

test("delivery note adds the NCM tracking code and nothing else", () => {
  const shipped = {
    ...SAMPLE_POS_ORDER,
    shipment: { id: "s1", orderId: "ord_1", provider: "NCM", externalId: "778899", trackingCode: "778899", status: "ORDER_CREATED", timeline: [], charge: 150, codAmount: 2047, createdAt: SAMPLE_POS_ORDER.createdAt, updatedAt: null },
  } as unknown as PosOrder;
  const store = companyFromStore(REAL_STORE);
  const html = deliveryNotesHtml({ orders: [shipped], company: store });
  assert.ok(html.includes(`NCM tracking: <strong class="mono">778899</strong>`));
  const normalised = tokeniseCompany(html.replace(NEW_LOGO_IMG, "[LOGO]"), store)
    .replace(`<p>NCM tracking: <strong class="mono">778899</strong></p>`, "")
    .replace("Assignee: Nepal Can Move", "Assignee: —");
  assert.equal(normalised, tokeniseCompany(oldDelivery("{LEGAL}"), OLD_COMPANY_AS_BILL));
});
