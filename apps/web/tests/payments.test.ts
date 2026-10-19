import { test } from "node:test";
import assert from "node:assert/strict";
import type { PaymentSettings } from "../src/lib/api/types";
import { enabledPaymentMethods, isScreenMethod, paymentAccount } from "../src/lib/pos/payments";

const settings = (over: Partial<{ [K in keyof PaymentSettings]: Partial<PaymentSettings[K]> }> = {}): PaymentSettings => {
  const base: PaymentSettings = {
    cash: { enabled: true },
    fonepay: { enabled: true, merchantName: "Merchant", terminalId: "T-1", qrImageUrl: "https://res.cloudinary.com/x/fonepay.png" },
    esewa: { enabled: true, accountName: "Owner", accountId: "9800000000", qrImageUrl: "" },
    khalti: { enabled: true, accountName: "Owner", accountId: "9811111111", qrImageUrl: "" },
    card: { enabled: true },
    bank: { enabled: true, bankName: "Bank", accountName: "Shop", accountNumber: "0123456789", branch: "Thimi", qrImageUrl: "" },
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v, ...(over[k as keyof PaymentSettings] ?? {}) }])) as unknown as PaymentSettings;
};

test("only methods enabled in Settings are offered, in counter order", () => {
  assert.deepEqual(enabledPaymentMethods(settings()), ["CASH", "FONEPAY_QR", "ESEWA", "KHALTI", "CARD", "BANK_TRANSFER"]);
  assert.deepEqual(enabledPaymentMethods(settings({ esewa: { enabled: false }, card: { enabled: false }, bank: { enabled: false } })), ["CASH", "FONEPAY_QR", "KHALTI"]);
});

test("cash is always available, even without config", () => {
  assert.deepEqual(enabledPaymentMethods(settings({ cash: { enabled: false } })).slice(0, 1), ["CASH"]);
  assert.deepEqual(enabledPaymentMethods(null), ["CASH"]);
});

test("wallet / bank methods open the customer screen with their account details", () => {
  assert.equal(isScreenMethod("FONEPAY_QR"), true);
  assert.equal(isScreenMethod("CASH"), false);
  assert.equal(isScreenMethod("CARD"), false);
  const esewa = paymentAccount("ESEWA", settings());
  assert.equal(esewa.idLabel, "eSewa ID");
  assert.equal(esewa.idValue, "9800000000");
  assert.equal(esewa.qrImageUrl, "");
  const fonepay = paymentAccount("FONEPAY_QR", settings());
  assert.equal(fonepay.qrImageUrl, "https://res.cloudinary.com/x/fonepay.png");
  assert.equal(fonepay.accountName, "Merchant");
  const bank = paymentAccount("BANK_TRANSFER", settings());
  assert.deepEqual(bank.extra, ["Bank", "Thimi"]);
  assert.equal(bank.idValue, "0123456789");
});
