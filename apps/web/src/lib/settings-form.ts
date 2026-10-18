/** Helpers for the Settings forms: change detection, minimal patches and the server's validation rules. */
import type { PaymentSettings, PosSettings } from "@/lib/api/types";

/** Keys whose value differs (shallow). */
export function changedFields<T extends object>(original: T, draft: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(draft) as Array<keyof T>) {
    if (draft[key] !== original[key]) out[key] = draft[key];
  }
  return out;
}

export function isDirty<T extends object>(original: T, draft: T): boolean {
  return Object.keys(changedFields(original, draft)).length > 0;
}

/** Payments patch with only the changed fields of the changed methods. */
export function paymentsPatch(original: PaymentSettings, draft: PaymentSettings): { [K in keyof PaymentSettings]?: Partial<PaymentSettings[K]> } {
  const out: { [K in keyof PaymentSettings]?: Partial<PaymentSettings[K]> } = {};
  for (const key of Object.keys(draft) as Array<keyof PaymentSettings>) {
    const diff = changedFields(original[key] as object, draft[key] as object);
    if (Object.keys(diff).length) (out as Record<string, unknown>)[key] = diff;
  }
  return out;
}

const HTTPS = /^https:\/\/\S+$/i;

export type FieldErrors = Record<string, string>;

/** Store profile rules (mirror backend posSettingsPatchSchema). */
export function storeErrors(s: PosSettings["store"]): FieldErrors {
  const e: FieldErrors = {};
  if (!s.name.trim()) e.name = "Enter the shop name.";
  if (s.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) e.email = "Enter a valid email, or leave it empty.";
  if (s.pan.trim() && !/^\d{9}$/.test(s.pan.trim())) e.pan = "PAN is 9 digits.";
  if (s.vatNumber.trim().length > 20) e.vatNumber = "Too long (20 characters max).";
  if (s.logoUrl.trim() && !HTTPS.test(s.logoUrl.trim())) e.logoUrl = "Use an https:// link, or upload the logo.";
  return e;
}

export function posErrors(p: PosSettings["pos"]): FieldErrors {
  const e: FieldErrors = {};
  if (!Number.isFinite(p.vatRate) || p.vatRate < 0 || p.vatRate > 50) e.vatRate = "VAT rate must be between 0 and 50.";
  if (!/^[A-Z0-9]{2,8}$/.test(p.billPrefix)) e.billPrefix = "2 to 8 capital letters or numbers, e.g. GLM.";
  if (!Number.isFinite(p.maxCashierDiscountPct) || p.maxCashierDiscountPct < 0 || p.maxCashierDiscountPct > 100) e.maxCashierDiscountPct = "Between 0 and 100.";
  if (p.receiptFooter.length > 500) e.receiptFooter = "Keep the footer under 500 characters.";
  return e;
}

export function paymentErrors(p: PaymentSettings): FieldErrors {
  const e: FieldErrors = {};
  const url = (key: string, v: string) => {
    if (v.trim() && !HTTPS.test(v.trim())) e[key] = "Use an https:// link, or upload the QR image.";
  };
  url("fonepay.qrImageUrl", p.fonepay.qrImageUrl);
  url("esewa.qrImageUrl", p.esewa.qrImageUrl);
  url("khalti.qrImageUrl", p.khalti.qrImageUrl);
  url("bank.qrImageUrl", p.bank.qrImageUrl);
  if (p.bank.accountNumber.trim() && !/^[A-Za-z0-9 -]{4,40}$/.test(p.bank.accountNumber.trim())) e["bank.accountNumber"] = "4 to 40 letters, numbers, spaces or dashes.";
  for (const [key, v] of [["esewa.accountId", p.esewa.accountId], ["khalti.accountId", p.khalti.accountId], ["fonepay.terminalId", p.fonepay.terminalId]] as const) {
    if (v.length > 60) e[key] = "Too long (60 characters max).";
  }
  return e;
}
