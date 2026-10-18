/**
 * Bill / delivery-note parity: the GLAMO POS print code must render exactly
 * what the original print-bill.ts / print-delivery.ts rendered (fixture
 * captured from the old code in tests/fixtures/print-old.json), except for
 * the logo and the company block.
 */
import { captureHtml, capturePdf, type PdfOp } from "./helpers/print-capture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { billOptsFromBillData, companyFromStore, downloadStoreBillPdf, printStoreBill, type BillCompany } from "../src/lib/print-bill";
import { printDeliveryNotes } from "../src/lib/print-delivery";
import type { BillData, PosOrder } from "../src/lib/api/types";
import {
  OLD_COMPANY, OLD_COMPANY_AS_BILL, REAL_STORE, SAMPLE_BILL_DATA, SAMPLE_BILL_OPTS, SAMPLE_POS_ORDER, SAMPLE_TAX_OPTS,
} from "./fixtures/print-samples";

const old = JSON.parse(readFileSync(new URL("./fixtures/print-old.json", import.meta.url), "utf8")) as {
  billHtml: string; taxBillHtml: string; billPdfOps: PdfOp[]; taxBillPdfOps: PdfOp[]; deliveryHtml: string;
};

/** Remove the (new) embedded logo element + its CSS rule from bill HTML. */
function stripBillLogo(html: string) {
  return html
    .replace(/\n {2}\.logo\{[^\n]*\}\n/, "\n")
    .replace(/\n {2}<div class="logo"><img src="data:image\/png;base64,[^"]+" alt="[^"]*" width="\d+" height="\d+"\/><\/div>/, "");
}

/** Replace each company field value with a token so only layout is compared. */
function tokeniseCompany(text: string, c: BillCompany) {
  const pairs: Array<[string, string]> = [
    [c.address, "{ADDRESS}"], [c.email ?? "", "{EMAIL}"], [c.phone, "{PHONE}"], [c.name, "{NAME}"], [c.pan, "{PAN}"], [c.vat ?? "", "{VAT}"],
  ];
  let out = text;
  for (const [value, token] of pairs.filter(([v]) => v).sort((a, b) => b[0].length - a[0].length)) out = out.split(value).join(token);
  return out;
}

const withoutLogoOps = (ops: PdfOp[]) => ops.filter(([name]) => name !== "addImage");

test("bill HTML is byte-identical to the old layout apart from the logo (same company data)", () => {
  const html = captureHtml(() => printStoreBill({ ...SAMPLE_BILL_OPTS, company: OLD_COMPANY_AS_BILL }));
  assert.match(html, /<div class="logo"><img src="data:image\/png;base64,/, "logo embedded as data URL");
  assert.equal(stripBillLogo(html), old.billHtml);
  const tax = captureHtml(() => printStoreBill({ ...SAMPLE_TAX_OPTS, company: OLD_COMPANY_AS_BILL }));
  assert.equal(stripBillLogo(tax), old.taxBillHtml);
});

test("bill PDF draws the same ops as before plus only the logo image", () => {
  const ops = capturePdf(() => downloadStoreBillPdf({ ...SAMPLE_BILL_OPTS, company: OLD_COMPANY_AS_BILL }));
  const images = ops.filter(([n]) => n === "addImage");
  assert.equal(images.length, 1);
  assert.match(String(images[0][1]), /^data:image\/png;base64,/);
  assert.deepEqual(withoutLogoOps(ops), old.billPdfOps);
  const tax = capturePdf(() => downloadStoreBillPdf({ ...SAMPLE_TAX_OPTS, company: OLD_COMPANY_AS_BILL }));
  assert.deepEqual(withoutLogoOps(tax), old.taxBillPdfOps);
});

test("real store settings change only the company fields", () => {
  const store = companyFromStore(REAL_STORE);
  const html = captureHtml(() => printStoreBill({ ...SAMPLE_BILL_OPTS, company: store }));
  assert.ok(html.includes("S.S Chowk, Madhyapur Thimi, Bagmati"));
  assert.ok(html.includes("+977 9818212188"));
  assert.ok(!html.includes(OLD_COMPANY.phone));
  assert.equal(tokeniseCompany(stripBillLogo(html), store), tokeniseCompany(old.billHtml, OLD_COMPANY_AS_BILL));

  const ops = withoutLogoOps(capturePdf(() => downloadStoreBillPdf({ ...SAMPLE_BILL_OPTS, company: store })));
  assert.equal(ops.length, old.billPdfOps.length);
  const isCompanyText = (s: unknown, c: BillCompany) =>
    typeof s === "string" && (s === c.name || s === c.phone || s === `PAN ${c.pan}` || (s.length > 3 && c.address.includes(s)));
  ops.forEach((op, i) => {
    const before = old.billPdfOps[i];
    if (op[0] === "text" && isCompanyText(op[1], store) && isCompanyText(before[1], OLD_COMPANY_AS_BILL)) {
      assert.deepEqual(op.slice(2), before.slice(2), `op ${i} keeps position`);
      return;
    }
    assert.deepEqual(op, before, `op ${i}`);
  });
});

test("BillData from the server maps onto the bill lines", () => {
  const opts = billOptsFromBillData(SAMPLE_BILL_DATA as BillData);
  assert.equal(opts.orderId, "GLM-261018-0042");
  assert.deepEqual(opts.lines, SAMPLE_BILL_OPTS.lines);
  assert.equal(opts.method, "Cash + Fonepay QR");
  assert.equal(opts.total, 2897);
  assert.equal(opts.vat, 333);
  assert.equal(opts.company.address, REAL_STORE.address);
  const html = captureHtml(() => printStoreBill({ ...opts, method: SAMPLE_BILL_OPTS.method, company: OLD_COMPANY_AS_BILL }));
  assert.equal(stripBillLogo(html), old.billHtml, "BillData path renders the identical layout");
});

const OLD_LOGO_SVG = /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 120 120"[\s\S]*?<\/svg>/g;
const NEW_LOGO_IMG = /<img src="data:image\/png;base64,[^"]+" alt="Glamo Nepal" width="\d+" height="\d+"\/>/g;

test("delivery note matches the old layout apart from the logo", () => {
  const html = captureHtml(() => printDeliveryNotes({ orders: [SAMPLE_POS_ORDER as unknown as PosOrder], company: OLD_COMPANY_AS_BILL }));
  assert.equal((html.match(NEW_LOGO_IMG) ?? []).length, 2, "both logo spots use the PNG data URL");
  assert.equal(html.replace(NEW_LOGO_IMG, "[LOGO]"), old.deliveryHtml.replace(OLD_LOGO_SVG, "[LOGO]"));
});

test("delivery note adds the NCM tracking code and nothing else", () => {
  const shipped = {
    ...SAMPLE_POS_ORDER,
    shipment: { id: "s1", orderId: "ord_1", provider: "NCM", externalId: "778899", trackingCode: "778899", status: "ORDER_CREATED", timeline: [], charge: 150, codAmount: 2047, createdAt: SAMPLE_POS_ORDER.createdAt, updatedAt: null },
  } as unknown as PosOrder;
  const store = companyFromStore(REAL_STORE);
  const html = captureHtml(() => printDeliveryNotes({ orders: [shipped], company: store }));
  assert.ok(html.includes(`NCM tracking: <strong class="mono">778899</strong>`));
  const normalised = tokeniseCompany(html.replace(NEW_LOGO_IMG, "[LOGO]"), store)
    .replace(`<p>NCM tracking: <strong class="mono">778899</strong></p>`, "")
    .replace("Assignee: Nepal Can Move", "Assignee: —");
  assert.equal(normalised, tokeniseCompany(old.deliveryHtml.replace(OLD_LOGO_SVG, "[LOGO]"), OLD_COMPANY_AS_BILL));
});
