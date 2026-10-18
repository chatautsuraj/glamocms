import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateProRata, computeCartTotals, extractVat, summariseTenders, kathmanduDay } from "../src/lib/pos/math";
import { WedgeDetector, isTypingTarget } from "../src/lib/pos/scanner";

const lines = [
  { unitPrice: 1450, quantity: 1, vatApplicable: true },
  { unitPrice: 325, quantity: 2, vatApplicable: true },
  { unitPrice: 299, quantity: 3, lineDiscount: 100, vatApplicable: true },
];

test("VAT is extracted from VAT-inclusive shelf prices (13%)", () => {
  assert.equal(extractVat(1130, 13), 130);
  assert.equal(extractVat(0, 13), 0);
  assert.equal(extractVat(1000, 0), 0);
  const t = computeCartTotals({ lines, vatRate: 13 });
  assert.equal(t.subtotal, 2897);
  assert.equal(t.total, 2897, "VAT-inclusive: total = subtotal");
  assert.equal(t.vatAmount, Math.round((2897 * 13) / 113));
  assert.equal(t.taxableAmount + t.vatAmount, 2897);
});

test("order discount is pro-rated with integer parts summing exactly", () => {
  assert.deepEqual(allocateProRata(200, [1450, 650, 797]), [100, 45, 55]);
  assert.deepEqual(allocateProRata(0, [1, 2]), [0, 0]);
  const t = computeCartTotals({ lines, discount: 200, vatRate: 13 });
  assert.deepEqual(t.lines.map((l) => l.net), [1350, 605, 742]);
  assert.equal(t.total, 2697);
  assert.equal(t.vatAmount, 310);
  assert.equal(t.taxableAmount, 2387);
  assert.equal(t.lineDiscounts, 100);
  assert.equal(t.grossBeforeDiscounts, 2997);
});

test("per-SKU VAT toggle excludes non-VAT lines from the VAT base", () => {
  const t = computeCartTotals({ lines: lines.map((l, i) => ({ ...l, vatApplicable: i !== 2 })), discount: 200, vatRate: 13 });
  assert.equal(t.vatAmount, 225);
  assert.equal(t.taxableAmount, 1955 - 225);
});

test("discount is capped at subtotal; delivery charge is added on top", () => {
  const t = computeCartTotals({ lines: [{ unitPrice: 500, quantity: 1, vatApplicable: true }], discount: 900, vatRate: 13, deliveryCharge: 150 });
  assert.equal(t.discount, 500);
  assert.equal(t.total, 150);
});

test("cash tender computes change", () => {
  const s = summariseTenders([{ method: "CASH", amount: 3000 }], 2697);
  assert.equal(s.error, null);
  assert.equal(s.change, 303);
  assert.equal(s.booked[0].booked, 2697);
  assert.equal(s.remaining, 0);
});

test("split tender: QR + cash, change only from cash", () => {
  const s = summariseTenders([{ method: "FONEPAY_QR", amount: 1000, reference: "FP1" }, { method: "CASH", amount: 2000 }], 2697);
  assert.equal(s.error, null);
  assert.equal(s.tendered, 3000);
  assert.equal(s.change, 303);
  assert.deepEqual(s.booked.map((b) => b.booked), [1000, 1697]);
});

test("split tender across three methods sums exactly", () => {
  const s = summariseTenders([{ method: "ESEWA", amount: 697, reference: "E1" }, { method: "KHALTI", amount: 1000, reference: "K1" }, { method: "CARD", amount: 1000, reference: "C1" }], 2697, { requireReference: true });
  assert.equal(s.error, null);
  assert.equal(s.change, 0);
});

test("tender validation errors", () => {
  assert.equal(summariseTenders([{ method: "CASH", amount: 1000 }], 2697).error, "INSUFFICIENT_PAYMENT");
  assert.equal(summariseTenders([{ method: "CASH", amount: 1000 }], 2697).remaining, 1697);
  assert.equal(summariseTenders([{ method: "FONEPAY_QR", amount: 3000 }], 2697).error, "NON_CASH_OVERPAYMENT");
  assert.equal(summariseTenders([{ method: "CREDIT", amount: 2697 }], 2697).error, "CREDIT_REQUIRES_CUSTOMER");
  assert.equal(summariseTenders([{ method: "CREDIT", amount: 2697 }], 2697, { hasNamedCustomer: true }).error, null);
  assert.equal(summariseTenders([{ method: "CARD", amount: 2697 }], 2697, { requireReference: true }).error, "REFERENCE_REQUIRED");
});

test("delivery COD allows shortfall and reports due", () => {
  const s = summariseTenders([], 1850, { allowShortfall: true });
  assert.equal(s.error, null);
  assert.equal(s.due, 1850);
});

test("Kathmandu business day is UTC+05:45", () => {
  assert.equal(kathmanduDay(new Date("2026-10-18T18:14:00Z")), "2026-10-18");
  assert.equal(kathmanduDay(new Date("2026-10-18T18:16:00Z")), "2026-10-19");
});

test("keyboard-wedge detector accepts fast bursts ending in Enter, ignores typing", () => {
  const d = new WedgeDetector();
  let t = 1000;
  for (const ch of "8901030") assert.equal(d.push(ch, (t += 8)), null);
  assert.equal(d.push("Enter", (t += 8)), "8901030");
  // human typing: 150ms gaps
  for (const ch of "abcd") d.push(ch, (t += 150));
  assert.equal(d.push("Enter", (t += 150)), null);
  // too short
  d.push("1", (t += 5));
  assert.equal(d.push("Enter", (t += 5)), null);
});

test("typing targets are excluded from global scanning", () => {
  assert.equal(isTypingTarget({ tagName: "INPUT", type: "text" } as unknown as EventTarget), true);
  assert.equal(isTypingTarget({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget), false);
  assert.equal(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget), false);
  assert.equal(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget), true);
  assert.equal(isTypingTarget(null), false);
});
