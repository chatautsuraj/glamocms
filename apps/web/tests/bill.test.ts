import "./helpers/print-capture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { billHtml, billOptsFromBillData } from "../src/lib/print/bill";
import { companyFromStore } from "../src/lib/print/company";
import { billPdf } from "../src/lib/print/bill-pdf";
import type { BillData } from "../src/lib/api/types";
import { capturePdf, pdfTexts } from "./helpers/print-capture";
import { REAL_STORE, SAMPLE_BILL_DATA } from "./fixtures/print-samples";

const bill = (over: Partial<BillData> = {}) => ({ ...(SAMPLE_BILL_DATA as BillData), ...over });
const ESTIMATE = /estimate|not a tax invoice|thank you/i;

test("no estimate / not-a-tax-invoice / thank-you wording anywhere (HTML and PDF)", () => {
  for (const b of [bill(), bill({ taxInvoice: true }), bill({ vatEnabled: false, vatAmount: 0, vatRate: 0 })]) {
    const opts = billOptsFromBillData(b);
    assert.doesNotMatch(billHtml(opts), ESTIMATE);
    assert.doesNotMatch(pdfTexts(capturePdf(() => billPdf(opts))).join("\n"), ESTIMATE);
  }
});

test("VAT switched off → no VAT line on the bill", () => {
  const opts = billOptsFromBillData(bill({ vatEnabled: false, vatAmount: 0, vatRate: 0, taxableAmount: 2897 }));
  const html = billHtml(opts);
  assert.doesNotMatch(html, /<span>VAT \d+%<\/span>/);
  assert.doesNotMatch(pdfTexts(capturePdf(() => billPdf(opts))).join("\n"), /^VAT \d+%$/m);
  const on = billHtml(billOptsFromBillData(bill()));
  assert.match(on, /<span>VAT 13%<\/span><span>Rs 333<\/span>/);
});

test("tax invoice prints TAX INVOICE + 'Tax invoice · PAN …'; otherwise no tax line", () => {
  const tax = billHtml(billOptsFromBillData(bill({ taxInvoice: true })));
  assert.match(tax, /<p class="doc">TAX INVOICE<\/p>/);
  assert.match(tax, /Tax invoice · PAN 609876543/);
  const plain = billHtml(billOptsFromBillData(bill()));
  assert.match(plain, /<p class="doc">BILL<\/p>/);
  assert.doesNotMatch(plain, /Tax invoice/);
  const taxPdf = pdfTexts(capturePdf(() => billPdf(billOptsFromBillData(bill({ taxInvoice: true })))));
  assert.ok(taxPdf.includes("Tax invoice · PAN 609876543"));
});

test("receipt footer from Settings prints when set, nothing when empty", () => {
  const withFooter = billOptsFromBillData(bill({ footer: "Exchange within 7 days with bill\nFollow us @glamonepal" }));
  const html = billHtml(withFooter);
  assert.match(html, /<p class="note">Exchange within 7 days with bill<br\/>Follow us @glamonepal<\/p>/);
  const texts = pdfTexts(capturePdf(() => billPdf(withFooter)));
  assert.ok(texts.includes("Exchange within 7 days with bill") && texts.includes("Follow us @glamonepal"));
  assert.doesNotMatch(billHtml(billOptsFromBillData(bill({ footer: "" }))), /class="note"/);
});

test("store details come from settings; empty PAN prints no PAN line", () => {
  const html = billHtml(billOptsFromBillData(bill({ store: { ...REAL_STORE, pan: "", vatNumber: "" } })));
  assert.doesNotMatch(html, /PAN/);
  assert.match(html, /GLAMO Nepal Pvt\. Ltd\./, "legal name line");
  assert.equal(companyFromStore(REAL_STORE).name, "GLAMO Nepal");
});

test("money uses Indian grouping on the bill", () => {
  const html = billHtml(billOptsFromBillData(bill({ total: 123456, subtotal: 123456 })));
  assert.match(html, /Rs 1,23,456/);
});

test("discount, delivery, change and cash-on-delivery lines print only when they apply", () => {
  const plain = billHtml(billOptsFromBillData(bill()));
  assert.doesNotMatch(plain, /Discount|Delivery|Change|To pay on delivery/);
  const html = billHtml(billOptsFromBillData(bill({ discount: 200, deliveryCharge: 150, tendered: 3000, change: 103, due: 0 })));
  assert.match(html, /<span>Discount<\/span><span>-Rs 200<\/span>/);
  assert.match(html, /<span>Delivery<\/span><span>Rs 150<\/span>/);
  assert.match(html, /<span>Cash given<\/span><span>Rs 3,000<\/span>/);
  assert.match(html, /<span>Change<\/span><span>Rs 103<\/span>/);
  const cod = billOptsFromBillData(bill({ payments: [], tendered: 0, due: 2897 }));
  assert.match(billHtml(cod), /<span>To pay on delivery<\/span><span>Rs 2,897<\/span>/);
  assert.equal(cod.method, "Cash on delivery");
  assert.ok(pdfTexts(capturePdf(() => billPdf(cod))).includes("To pay on delivery"));
});
