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
  UNAUTHORIZED: "Your session has ended. Please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  POS_ACCESS_DENIED: "This Google account doesn't have POS access. Ask a manager to add you as staff.",
  ACCOUNT_INACTIVE: "Your staff account is switched off. Ask a manager to turn it back on.",
  SHIFT_ALREADY_OPEN: "You already entered the starting cash for today.",
  SHIFT_NOT_OPEN: "Enter the starting cash first, then count at the end of the day.",
  SHIFT_FORBIDDEN: "That cash drawer belongs to another cashier.",
  INSUFFICIENT_STOCK: "Not enough stock for one or more items.",
  VARIANT_REQUIRED: "Choose a shade first.",
  PRICE_OVERRIDE_FORBIDDEN: "Only a manager can change the selling price.",
  DISCOUNT_LIMIT_EXCEEDED: "That discount is above your limit. Ask a manager.",
  INSUFFICIENT_PAYMENT: "The payments don't cover the total yet.",
  NON_CASH_OVERPAYMENT: "Only cash can be more than the total (change is given in cash).",
  INVALID_PAYMENT_AMOUNT: "Payment amounts must be whole rupees.",
  PAYMENT_METHOD_DISABLED: "That payment method is switched off in Settings.",
  CUSTOMER_REQUIRED: "Add the customer's phone number for this sale.",
  USE_SALES_SYNC: "This sale is too old to save directly. It will be sent with the offline sales.",
  SALE_IN_PROGRESS: "This sale is already being saved. Wait a moment.",
  PRODUCT_NOT_FOUND: "No product matches that code.",
  VARIANT_NOT_FOUND: "That shade no longer exists.",
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_FORBIDDEN: "You can only open your own sales.",
  ORDER_NOT_CANCELLABLE: "This order can't be cancelled any more.",
  ORDER_NOT_REFUNDABLE: "This order can't be refunded.",
  BARCODE_TAKEN: "Another product or shade already uses this barcode.",
  SKU_TAKEN: "Another product or shade already uses this SKU.",
  INVALID_BARCODE: "This barcode isn't valid. Re-scan it, or press Generate.",
  INVALID_SKU: "SKU can only use letters, numbers, spaces and . _ - / +",
  INVALID_SALE_PRICE: "Sale price must be lower than the normal price.",
  CATEGORY_EXISTS: "A category with this name already exists.",
  BRAND_EXISTS: "A brand with this name already exists.",
  UPLOADS_NOT_CONFIGURED: "Photo uploads aren't set up on the server yet. Paste an image link instead.",
  UPLOAD_FAILED: "The photo didn't upload. Try again.",
  FILE_REQUIRED: "Choose an image file first.",
  INVALID_IMAGE: "Use a JPG, PNG or WebP image under 5 MB.",
  INVALID_IMAGE_URL: "Use an https link from Cloudinary, Google Drive or glamonepal.com.",
  MAX_IMAGES_EXCEEDED: "A product can have up to 10 photos.",
  IMAGE_NOT_FOUND: "That photo was already removed.",
  NCM_NOT_CONFIGURED: "Nepal Can Move isn't connected on the server.",
  NCM_ERROR: "Nepal Can Move rejected the request.",
  NO_DELIVERY_ADDRESS: "This order has no delivery address (picked up at the counter).",
  WA_WINDOW_CLOSED: "The 24-hour WhatsApp reply window has closed. Send an approved template instead.",
  CONFLICT_RESOLVED: "That stock problem was already sorted.",
  SELF_UPDATE_FORBIDDEN: "You can't change your own role.",
  ROLE_FORBIDDEN: "You can't give that role.",
  RATE_LIMITED: "Too many requests. Wait a moment and try again.",
  VALIDATION_ERROR: "Please check the highlighted details.",
};

const FIELD_LABEL: Record<string, string> = {
  pan: "PAN", vatNumber: "VAT number", vatRate: "VAT rate", billPrefix: "Bill number prefix", qrImageUrl: "QR image", logoUrl: "Logo",
  accountNumber: "Account number", accountId: "ID / number", merchantName: "Merchant name", terminalId: "Terminal ID", receiptFooter: "Bill footer",
  maxCashierDiscountPct: "Cashier discount limit", basePrice: "Price", salePrice: "Sale price", categoryId: "Category",
};

/** "pos.vatRate: Number must be ≤ 50" → "VAT rate: Number must be ≤ 50" (first issue only). */
export function validationDetail(errors: string[]): string | null {
  const first = errors.find((e) => e.includes(":"));
  if (!first) return null;
  const [path, ...rest] = first.split(":");
  const key = path.split(".").pop() ?? path;
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const label = FIELD_LABEL[key] ?? `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  return `${label}: ${rest.join(":").trim()}`;
}

/** Human copy for any thrown value; falls back to the server message. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION_ERROR") return validationDetail(err.errors) ?? ERROR_COPY.VALIDATION_ERROR;
    const copy = ERROR_COPY[err.code];
    if (copy) {
      // Keep server detail for stock problems — it names the item.
      if ((err.code === "INSUFFICIENT_STOCK" || err.code === "NCM_ERROR") && err.message && err.message !== copy) return `${copy} ${err.message}`;
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
