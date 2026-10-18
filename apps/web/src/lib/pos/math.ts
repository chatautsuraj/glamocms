/**
 * Client-side POS money math — a faithful mirror of backend pos.math.ts so
 * the POS screen shows the same totals the server will book. The server
 * recomputes on every sale; these numbers are for display and offline bills.
 *
 * Shelf prices are VAT-inclusive. VAT is extracted from the VAT-applicable net
 * (after line + pro-rata order discount): vat = round(net × rate / (100+rate)).
 * With the global VAT switch off, VAT is 0 and the taxable amount is the net.
 */
import type { PaymentMethod } from "@/lib/api/types";

export interface LineInput {
  unitPrice: number;
  quantity: number;
  lineDiscount?: number;
  vatApplicable: boolean;
}

export interface LineTotals {
  gross: number;
  lineDiscount: number;
  lineTotal: number;
  allocatedDiscount: number;
  net: number;
  vatApplicable: boolean;
}

export interface CartTotals {
  lines: LineTotals[];
  subtotal: number;
  discount: number;
  lineDiscounts: number;
  grossBeforeDiscounts: number;
  taxableAmount: number;
  vatAmount: number;
  deliveryCharge: number;
  total: number;
}

const int = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

/** Split `amount` across `weights` proportionally, integer parts summing exactly to `amount`. */
export function allocateProRata(amount: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (amount <= 0 || totalWeight <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / totalWeight);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = amount - floors.reduce((s, f) => s + f, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

export function extractVat(grossInclusive: number, vatRate: number): number {
  if (grossInclusive <= 0 || vatRate <= 0) return 0;
  return Math.round((grossInclusive * vatRate) / (100 + vatRate));
}

export function computeCartTotals(input: {
  lines: LineInput[];
  discount?: number;
  vatRate: number;
  /** Global VAT switch (posConfig.vatEnabled). Default true, like the server. */
  vatEnabled?: boolean;
  deliveryCharge?: number;
}): CartTotals {
  const lines = input.lines.map((line) => {
    const unitPrice = int(line.unitPrice);
    const quantity = Math.max(1, Math.round(line.quantity || 1));
    const gross = unitPrice * quantity;
    const lineDiscount = Math.min(int(line.lineDiscount), gross);
    return { gross, lineDiscount, lineTotal: gross - lineDiscount, vatApplicable: line.vatApplicable };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const discount = Math.min(int(input.discount), subtotal);
  const allocations = allocateProRata(discount, lines.map((l) => l.lineTotal));
  const withNet: LineTotals[] = lines.map((l, i) => ({ ...l, allocatedDiscount: allocations[i], net: l.lineTotal - allocations[i] }));
  const vatEnabled = input.vatEnabled !== false;
  const vatableGross = withNet.filter((l) => l.vatApplicable).reduce((s, l) => s + l.net, 0);
  const vatAmount = vatEnabled ? extractVat(vatableGross, input.vatRate) : 0;
  const deliveryCharge = int(input.deliveryCharge);
  return {
    lines: withNet,
    subtotal,
    discount,
    lineDiscounts: lines.reduce((s, l) => s + l.lineDiscount, 0),
    grossBeforeDiscounts: lines.reduce((s, l) => s + l.gross, 0),
    taxableAmount: vatEnabled ? vatableGross - vatAmount : subtotal - discount,
    vatAmount,
    deliveryCharge,
    total: subtotal - discount + deliveryCharge,
  };
}

/** Total discount as % of pre-discount gross (line + order discounts). */
export function discountPercent(t: Pick<CartTotals, "grossBeforeDiscounts" | "lineDiscounts" | "discount">): number {
  if (t.grossBeforeDiscounts <= 0) return 0;
  return ((t.lineDiscounts + t.discount) / t.grossBeforeDiscounts) * 100;
}

export interface Tender {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface TenderSummary {
  /** Σ handed over. */
  tendered: number;
  /** Change returned in cash. */
  change: number;
  /** Still owed before the sale can complete (0 when covered). */
  remaining: number;
  /** Booked per line (cash net of change). */
  booked: Array<Tender & { booked: number }>;
  /** Machine code if the tender set is invalid, else null. */
  error: null | "INSUFFICIENT_PAYMENT" | "NON_CASH_OVERPAYMENT" | "REFERENCE_REQUIRED";
  /** COD/delivery: amount left due on delivery. */
  due: number;
}

/** Methods where a transaction / approval reference can be noted (optional). */
export const REFERENCE_METHODS: PaymentMethod[] = ["CARD", "FONEPAY_QR", "KHALTI", "ESEWA", "BANK_TRANSFER"];

/**
 * Validate a (possibly split) set of tenders against the bill total.
 * Mirrors server computeTender: change only in cash; Σ tendered ≥ total unless
 * `allowShortfall` (delivery COD).
 */
export function summariseTenders(
  tenders: Tender[],
  total: number,
  opts: { allowShortfall?: boolean; requireReference?: boolean } = {},
): TenderSummary {
  const lines = tenders.map((t) => ({ ...t, amount: int(t.amount), booked: int(t.amount) }));
  const tendered = lines.reduce((s, l) => s + l.amount, 0);
  let error: TenderSummary["error"] = null;
  const remaining = Math.max(0, total - tendered);
  if (remaining > 0 && !opts.allowShortfall) error = "INSUFFICIENT_PAYMENT";
  let change = Math.max(0, tendered - total);
  const cashTendered = lines.filter((l) => l.method === "CASH").reduce((s, l) => s + l.amount, 0);
  if (change > cashTendered) error = error ?? "NON_CASH_OVERPAYMENT";
  let left = Math.min(change, cashTendered);
  for (let i = lines.length - 1; i >= 0 && left > 0; i--) {
    if (lines[i].method !== "CASH") continue;
    const take = Math.min(left, lines[i].booked);
    lines[i].booked -= take;
    left -= take;
  }
  change = Math.min(change, cashTendered);
  if (opts.requireReference && lines.some((l) => REFERENCE_METHODS.includes(l.method) && l.amount > 0 && !l.reference?.trim())) {
    error = error ?? "REFERENCE_REQUIRED";
  }
  const paid = lines.reduce((s, l) => s + l.booked, 0);
  return { tendered, change, remaining, booked: lines, error, due: Math.max(0, total - paid) };
}

/**
 * Quick cash buttons: exact amount, then the next round 100 / 500 / 1000
 * (duplicates dropped). Rs 1,250 → [1250, 1300, 1500, 2000].
 */
export function quickCashAmounts(total: number): number[] {
  const t = int(total);
  if (t <= 0) return [];
  const up = (step: number) => Math.ceil(t / step) * step;
  return [...new Set([t, up(100), up(500), up(1000)])];
}

/**
 * Counted minus expected drawer cash. Positive = extra cash, negative = short.
 * Expected = starting cash + cash sales (net of change) − cash refunds (server).
 */
export function drawerDifference(expectedCash: number, counted: number) {
  return Math.round(counted) - Math.round(expectedCash);
}

/** Plain-words description of a drawer count for staff. */
export function describeDrawerDifference(diff: number, formatMoney: (n: number) => string): string {
  if (diff === 0) return "Exactly right";
  return diff > 0 ? `${formatMoney(diff)} extra in the drawer` : `${formatMoney(-diff)} short`;
}

/** Kathmandu calendar day YYYY-MM-DD (UTC+05:45) for an instant. */
export function kathmanduDay(date = new Date()): string {
  return new Date(date.getTime() + 345 * 60_000).toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
