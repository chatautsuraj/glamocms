/**
 * One-off: run against the ORIGINAL print-bill.ts / print-delivery.ts (commit
 * before the GLAMO POS rewrite) to snapshot their output. Kept in git history
 * only; the parity test compares the new code against the JSON it wrote.
 *   npx tsx tests/fixtures/generate-print-fixtures.ts
 */
import { captureHtml, capturePdf } from "../helpers/print-capture";
import { writeFileSync } from "node:fs";
import { printStoreBill, downloadStoreBillPdf } from "../../src/lib/print-bill";
import { printDeliveryNotes } from "../../src/lib/print-delivery";
import { SAMPLE_BILL_OPTS, SAMPLE_TAX_OPTS, SAMPLE_OLD_DELIVERY_ORDER } from "./print-samples";

const fixture = {
  generatedFrom: "apps/web/src/lib/print-bill.ts + print-delivery.ts before GLAMO POS rewrite",
  billHtml: captureHtml(() => printStoreBill(SAMPLE_BILL_OPTS)),
  taxBillHtml: captureHtml(() => printStoreBill(SAMPLE_TAX_OPTS)),
  billPdfOps: capturePdf(() => downloadStoreBillPdf(SAMPLE_BILL_OPTS)),
  taxBillPdfOps: capturePdf(() => downloadStoreBillPdf(SAMPLE_TAX_OPTS)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deliveryHtml: captureHtml(() => printDeliveryNotes({ orders: [SAMPLE_OLD_DELIVERY_ORDER as any] })),
};
writeFileSync(new URL("./print-old.json", import.meta.url), JSON.stringify(fixture, null, 2));
console.log("wrote print-old.json", Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, typeof v === "string" ? v.length : Array.isArray(v) ? v.length : v])));
