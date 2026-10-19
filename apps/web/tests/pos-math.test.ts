import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateProRata, computeCartTotals, describeDrawerDifference, drawerDifference, extractVat, quickCashAmounts, summariseTenders, kathmanduDay } from "../src/lib/pos/math";

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
  assert.equal(summariseTenders([{ method: "CARD", amount: 2697 }], 2697, { requireReference: true }).error, "REFERENCE_REQUIRED");
  assert.equal(summariseTenders([{ method: "ESEWA", amount: 2697 }], 2697).error, null, "wallet reference is optional at the counter");
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

test("VAT switched off globally: no VAT, taxable = net, totals unchanged", () => {
  const on = computeCartTotals({ lines, discount: 200, vatRate: 13, vatEnabled: true });
  const off = computeCartTotals({ lines, discount: 200, vatRate: 13, vatEnabled: false });
  assert.equal(off.vatAmount, 0);
  assert.equal(off.taxableAmount, 2697);
  assert.equal(off.total, on.total, "shelf prices are VAT-inclusive, so the customer pays the same");
  assert.equal(off.subtotal, 2897);
  assert.equal(computeCartTotals({ lines, vatRate: 0 }).vatAmount, 0, "rate 0 behaves like off");
});

test("quick cash buttons: exact, then next 100 / 500 / 1000 without duplicates", () => {
  assert.deepEqual(quickCashAmounts(1250), [1250, 1300, 1500, 2000]);
  assert.deepEqual(quickCashAmounts(1000), [1000]);
  assert.deepEqual(quickCashAmounts(2697), [2697, 2700, 3000]);
  assert.deepEqual(quickCashAmounts(0), []);
});

test("cash drawer count is described in plain words", () => {
  const money = (n: number) => `Rs ${n}`;
  assert.equal(drawerDifference(5000, 5000), 0);
  assert.equal(describeDrawerDifference(drawerDifference(5000, 5000), money), "Exactly right");
  assert.equal(describeDrawerDifference(drawerDifference(5000, 4800), money), "Rs 200 short");
  assert.equal(describeDrawerDifference(drawerDifference(5000, 5150), money), "Rs 150 extra in the drawer");
});

import { buildLocalBill, buildSalePayload, cartTotals, createCartStore, lineFromProduct } from "../src/lib/pos/cart";
import type { PosProduct, StoreProfile } from "../src/lib/api/types";

const prod = (over: Partial<PosProduct> = {}): PosProduct => ({
  id: "p1", sku: "LIP-01", barcode: "8901", name: "Matte Lipstick", brand: "GLAMO", category: "Lips", price: 1130, basePrice: 1130, salePrice: null,
  mrp: 1200, vatApplicable: true, posVisible: true, stock: 4, lowStockThreshold: 2, imageUrl: null, isActive: true, attributes: {}, variants: [], updatedAt: null, ...over,
});

test("cart merges repeat scans and builds the POST /pos/sales payload", () => {
  const cart = createCartStore();
  cart.getState().add(lineFromProduct(prod(), null));
  cart.getState().add(lineFromProduct(prod(), null));
  const shaded = prod({ id: "p2", variants: [{ id: "v9", name: "Ruby 09", sku: "LIP-09", barcode: "8909", price: 990, stock: 2 }] });
  assert.equal(cart.getState().lastKey, "p1:", "last added line drives the scan flash");
  cart.getState().add(lineFromProduct(shaded, "v9"));
  cart.getState().setLineDiscount("p2:v9", 90);
  const { lines } = cart.getState();
  assert.equal(lines.length, 2);
  assert.equal(lines[0].quantity, 2);
  const payload = buildSalePayload({
    clientRef: "11111111-2222-4333-8444-555555555555", lines, discount: 100, shiftId: "shift-1",
    customer: { name: " Sita ", phone: "9800000001", email: "" },
    tenders: [{ method: "CASH", amount: 2000 }, { method: "FONEPAY_QR", amount: 1250, reference: " FP-77 " }, { method: "CARD", amount: 0 }],
  });
  assert.deepEqual(payload, {
    clientRef: "11111111-2222-4333-8444-555555555555",
    shiftId: "shift-1",
    channel: "POS_COUNTER",
    customer: { name: "Sita", phone: "9800000001" },
    items: [{ productId: "p1", quantity: 2 }, { productId: "p2", variantId: "v9", quantity: 1, lineDiscount: 90 }],
    discount: 100,
    payments: [{ method: "CASH", amount: 2000 }, { method: "FONEPAY_QR", amount: 1250, reference: "FP-77" }],
  });
  cart.getState().setUnitPrice("p1:", 1000);
  assert.equal(buildSalePayload({ clientRef: "x".repeat(8), lines: cart.getState().lines, discount: 0, tenders: [] }).items[0].unitPrice, 1000, "override only when price changed");
});

test("offline bill mirrors server BillData math (VAT-inclusive, split, change)", () => {
  const store = { name: "GLAMO Nepal", address: "S.S Chowk, Madhyapur Thimi, Bagmati", phone: "+977 9818212188" } as StoreProfile;
  const lines = [lineFromProduct(prod(), null)];
  lines[0].quantity = 2;
  const bill = buildLocalBill({ lines, discount: 60, vat: { enabled: true, rate: 13 }, taxInvoice: false, tenders: [{ method: "ESEWA", amount: 1000, reference: "E1" }, { method: "CASH", amount: 1500 }], cashierName: "Asha", store });
  assert.equal(bill.subtotal, 2260);
  assert.equal(bill.total, 2200);
  assert.equal(bill.vatAmount, Math.round((2200 * 13) / 113));
  assert.equal(bill.taxableAmount + bill.vatAmount, 2200);
  assert.equal(bill.tendered, 2500);
  assert.equal(bill.change, 300);
  assert.deepEqual(bill.payments, [{ method: "ESEWA", amount: 1000, reference: "E1" }, { method: "CASH", amount: 1200, reference: null }]);
  assert.equal(bill.customer.name, "Walk-in Customer");
  assert.equal(bill.vatEnabled, true);
});

test("offline bill with VAT switched off carries no VAT and no tax-invoice flag", () => {
  const store = { name: "GLAMO Nepal", address: "", phone: "", pan: "601234567" } as StoreProfile;
  const lines = [lineFromProduct(prod(), null, 2)];
  const bill = buildLocalBill({ lines, discount: 0, vat: { enabled: false, rate: 0 }, taxInvoice: true, tenders: [{ method: "CASH", amount: 2260 }], cashierName: "Asha", store });
  assert.equal(bill.vatAmount, 0);
  assert.equal(bill.vatRate, 0);
  assert.equal(bill.vatEnabled, false);
  assert.equal(bill.taxInvoice, false);
  assert.equal(bill.taxableAmount, 2260);
  assert.equal(cartTotals(lines, 0, { enabled: false, rate: 13 }).vatAmount, 0);
});

test("cart stepper: +/- on a line, removing at zero", () => {
  const cart = createCartStore();
  cart.getState().add(lineFromProduct(prod(), null));
  cart.getState().bumpQty("p1:", 1);
  assert.equal(cart.getState().lines[0].quantity, 2);
  cart.getState().bumpQty("p1:", -2);
  assert.equal(cart.getState().lines.length, 0);
  assert.equal(cart.getState().lastKey, null);
});
