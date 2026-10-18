/** API error type + friendly copy for machine codes returned in `errors[0]`. */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: string[];

  constructor(message: string, status: number, code: string, errors: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  /** True when the request never reached the server (offline, DNS, CORS, timeout). */
  get isNetwork() {
    return this.status === 0;
  }
}

export const ERROR_COPY: Record<string, string> = {
  NETWORK_ERROR: "Can't reach the GLAMO server. Check the internet connection.",
  UNAUTHORIZED: "Your session expired — please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  POS_ACCESS_DENIED: "This Google account doesn't have POS access. Ask a manager to add you as staff.",
  ACCOUNT_INACTIVE: "Your staff account is inactive. Ask a manager to re-activate it.",
  TILL_NOT_OPEN: "Open the till before taking counter sales.",
  TILL_ALREADY_OPEN: "You already have an open till.",
  INSUFFICIENT_STOCK: "Not enough stock for one or more items.",
  VARIANT_REQUIRED: "Choose a shade / variant for this product first.",
  PRICE_OVERRIDE_FORBIDDEN: "Only a manager can change the selling price.",
  DISCOUNT_LIMIT_EXCEEDED: "That discount is above the cashier limit — ask a manager.",
  INSUFFICIENT_PAYMENT: "Payments don't cover the bill total yet.",
  NON_CASH_OVERPAYMENT: "Only cash can be over-tendered (change is given in cash).",
  INVALID_PAYMENT_AMOUNT: "Payment amounts must be whole rupees.",
  CREDIT_REQUIRES_CUSTOMER: "Khata (credit) needs a named customer with a phone number.",
  PRODUCT_NOT_FOUND: "No product matches that code.",
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_FORBIDDEN: "You can only view your own sales.",
  BARCODE_TAKEN: "Another product already uses this barcode.",
  NCM_NOT_CONFIGURED: "Nepal Can Move isn't configured on the server yet.",
  NCM_ERROR: "Nepal Can Move rejected the request.",
  NO_DELIVERY_ADDRESS: "This order has no delivery address (counter pickup).",
  WA_WINDOW_CLOSED: "The 24-hour WhatsApp window is closed — send an approved template instead.",
  CONFLICT_RESOLVED: "That conflict was already resolved.",
  RATE_LIMITED: "Too many requests — wait a moment and try again.",
  VALIDATION_ERROR: "Some fields are invalid.",
};

/** Human copy for any thrown value; falls back to the server message. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    const copy = ERROR_COPY[err.code];
    if (copy) {
      // Keep server detail for stock / validation problems — it names the item.
      if ((err.code === "INSUFFICIENT_STOCK" || err.code === "VALIDATION_ERROR" || err.code === "NCM_ERROR") && err.message && err.message !== copy) {
        return `${copy} ${err.message}`;
      }
      return copy;
    }
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Pick the machine code: first entry of errors[] that looks like CONSTANT_CASE. */
export function codeFromErrors(errors: unknown, status: number): string {
  if (Array.isArray(errors)) {
    for (const e of errors) {
      if (typeof e === "string" && /^[A-Z][A-Z0-9_]+$/.test(e)) return e;
      if (e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string") {
        return (e as { code: string }).code;
      }
    }
    if (errors.length > 0 && status === 400) return "VALIDATION_ERROR";
  }
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  return `HTTP_${status}`;
}
