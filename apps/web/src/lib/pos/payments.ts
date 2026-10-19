/**
 * Payment methods as configured in Settings → Payments (posConfig.payments).
 * Only enabled methods are offered at the POS; wallet / bank methods carry the
 * account details shown on the customer-facing payment screen.
 */
import type { PaymentMethod, PaymentSettings } from "@/lib/api/types";

/** Settings key for each tender method (mirrors backend PAYMENT_METHOD_SETTING). */
export const METHOD_SETTING: Record<PaymentMethod, keyof PaymentSettings> = {
  CASH: "cash",
  FONEPAY_QR: "fonepay",
  ESEWA: "esewa",
  KHALTI: "khalti",
  CARD: "card",
  BANK_TRANSFER: "bank",
};

/** Counter order of the payment buttons. */
export const METHOD_ORDER: PaymentMethod[] = ["CASH", "FONEPAY_QR", "ESEWA", "KHALTI", "CARD", "BANK_TRANSFER"];

/** Methods that open the large customer-facing payment screen (QR / account number). */
export const SCREEN_METHODS: PaymentMethod[] = ["FONEPAY_QR", "ESEWA", "KHALTI", "BANK_TRANSFER"];

export function isScreenMethod(method: PaymentMethod) {
  return SCREEN_METHODS.includes(method);
}

/** Enabled methods in counter order. Cash is always accepted (the server refuses to switch it off). */
export function enabledPaymentMethods(payments: PaymentSettings | null | undefined): PaymentMethod[] {
  if (!payments) return ["CASH"];
  return METHOD_ORDER.filter((m) => m === "CASH" || payments[METHOD_SETTING[m]]?.enabled === true);
}

export interface PaymentAccount {
  method: PaymentMethod;
  /** "Fonepay", "eSewa", … */
  title: string;
  /** Who the money goes to (merchant / account holder). */
  accountName: string;
  /** Main identifier customers type or check: eSewa ID, account number, terminal… */
  idLabel: string;
  idValue: string;
  /** Further details (bank + branch). */
  extra: string[];
  qrImageUrl: string;
}

const TITLE: Record<PaymentMethod, string> = {
  CASH: "Cash",
  FONEPAY_QR: "Fonepay",
  ESEWA: "eSewa",
  KHALTI: "Khalti",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
};

export function paymentTitle(method: PaymentMethod | string): string {
  return TITLE[method as PaymentMethod] ?? method.replace(/_/g, " ");
}

/** Account details for the customer-facing screen; empty strings when not filled in Settings. */
export function paymentAccount(method: PaymentMethod, payments: PaymentSettings | null | undefined): PaymentAccount {
  const base: PaymentAccount = { method, title: TITLE[method], accountName: "", idLabel: "", idValue: "", extra: [], qrImageUrl: "" };
  if (!payments) return base;
  switch (method) {
    case "FONEPAY_QR": {
      const p = payments.fonepay;
      return { ...base, accountName: p.merchantName, idLabel: "Terminal", idValue: p.terminalId, qrImageUrl: p.qrImageUrl };
    }
    case "ESEWA": {
      const p = payments.esewa;
      return { ...base, accountName: p.accountName, idLabel: "eSewa ID", idValue: p.accountId, qrImageUrl: p.qrImageUrl };
    }
    case "KHALTI": {
      const p = payments.khalti;
      return { ...base, accountName: p.accountName, idLabel: "Khalti ID", idValue: p.accountId, qrImageUrl: p.qrImageUrl };
    }
    case "BANK_TRANSFER": {
      const p = payments.bank;
      return {
        ...base,
        accountName: p.accountName,
        idLabel: "Account number",
        idValue: p.accountNumber,
        extra: [p.bankName, p.branch].filter(Boolean),
        qrImageUrl: p.qrImageUrl,
      };
    }
    default:
      return base;
  }
}
