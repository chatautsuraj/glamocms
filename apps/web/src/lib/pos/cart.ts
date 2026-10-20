/** POS cart (in-memory Zustand) + pure builders for the sale payload and the offline bill. */
import { create } from "zustand";
import type { BillData, DeliveryInput, PosProduct, SaleChannel, SaleCustomerInput, SalePayload, StoreProfile } from "@/lib/api/types";
import type { VatConfig } from "./config-store";
import { computeCartTotals, summariseTenders, type CartTotals, type Tender } from "./math";

export interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string | null;
  imageUrl: string | null;
  /** Shelf price (VAT-inclusive) from the catalog. */
  listPrice: number;
  /** Selling price; differs from listPrice only after a manager override. */
  unitPrice: number;
  quantity: number;
  lineDiscount: number;
  vatApplicable: boolean;
  stock: number;
  trackInventory: boolean;
}

export type CartCustomer = SaleCustomerInput;

export const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ""}`;

export function lineFromProduct(p: PosProduct, variantId: string | null, quantity = 1): CartLine {
  const v = variantId ? p.variants.find((x) => x.id === variantId) : undefined;
  const price = v ? v.price : p.price;
  return {
    key: lineKey(p.id, v?.id ?? null),
    productId: p.id,
    variantId: v?.id ?? null,
    name: p.name,
    variantName: v?.name ?? (p.attributes?.shade || null),
    sku: v?.sku ?? p.sku,
    imageUrl: p.imageUrl ?? null,
    listPrice: price,
    unitPrice: price,
    quantity,
    lineDiscount: 0,
    vatApplicable: true,
    stock: v ? v.stock : p.stock,
    trackInventory: p.trackInventory ?? true,
  };
}

interface CartState {
  lines: CartLine[];
  customer: CartCustomer | null;
  discount: number;
  notes: string;
  /** Last line added/changed by a scan or tap (drives the flash + keyboard +/-). */
  lastKey: string | null;
  /** Increments on every add so the same line can flash again. */
  addSeq: number;
  add: (line: CartLine) => CartLine;
  setQty: (key: string, qty: number) => void;
  bumpQty: (key: string, delta: number) => void;
  setLineDiscount: (key: string, amount: number) => void;
  setUnitPrice: (key: string, price: number) => void;
  remove: (key: string) => void;
  setCustomer: (c: CartCustomer | null) => void;
  setDiscount: (d: number) => void;
  setNotes: (n: string) => void;
  clear: () => void;
}

const clampInt = (n: number, min = 0) => Math.max(min, Math.round(Number(n) || 0));

export function createCartStore() {
  return create<CartState>((set, get) => ({
    lines: [],
    customer: null,
    discount: 0,
    notes: "",
    lastKey: null,
    addSeq: 0,
    add(line) {
      const existing = get().lines.find((l) => l.key === line.key);
      const next = existing ? { ...existing, quantity: existing.quantity + line.quantity } : line;
      set({
        lines: existing ? get().lines.map((l) => (l.key === line.key ? next : l)) : [...get().lines, line],
        lastKey: line.key,
        addSeq: get().addSeq + 1,
      });
      return next;
    },
    setQty: (key, qty) => set({ lines: get().lines.map((l) => (l.key === key ? { ...l, quantity: clampInt(qty, 1), lineDiscount: Math.min(l.lineDiscount, l.unitPrice * clampInt(qty, 1)) } : l)) }),
    bumpQty(key, delta) {
      const line = get().lines.find((l) => l.key === key);
      if (!line) return;
      if (line.quantity + delta < 1) get().remove(key);
      else get().setQty(key, line.quantity + delta);
    },
    setLineDiscount: (key, amount) =>
      set({ lines: get().lines.map((l) => (l.key === key ? { ...l, lineDiscount: Math.min(clampInt(amount), l.unitPrice * l.quantity) } : l)) }),
    setUnitPrice: (key, price) => set({ lines: get().lines.map((l) => (l.key === key ? { ...l, unitPrice: clampInt(price) } : l)) }),
    remove: (key) => {
      const lines = get().lines.filter((l) => l.key !== key);
      set({ lines, lastKey: get().lastKey === key ? (lines[lines.length - 1]?.key ?? null) : get().lastKey });
    },
    setCustomer: (customer) => set({ customer }),
    setDiscount: (d) => set({ discount: clampInt(d) }),
    setNotes: (notes) => set({ notes }),
    clear: () => set({ lines: [], customer: null, discount: 0, notes: "", lastKey: null }),
  }));
}

/** Counter (POS screen) cart and phone-order cart are independent. */
export const usePosCart = createCartStore();
export const usePhoneOrderCart = createCartStore();

export function cartTotals(lines: CartLine[], discount: number, vat: VatConfig, deliveryCharge = 0): CartTotals {
  return computeCartTotals({
    lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, lineDiscount: l.lineDiscount, vatApplicable: l.vatApplicable })),
    discount,
    vatRate: vat.rate,
    vatEnabled: vat.enabled,
    deliveryCharge,
  });
}

export function hasCustomerContact(c: CartCustomer | null | undefined) {
  return Boolean(c && (c.id || c.phone?.trim() || c.email?.trim()));
}

export function buildSalePayload(input: {
  clientRef: string;
  lines: CartLine[];
  discount: number;
  tenders: Tender[];
  customer?: CartCustomer | null;
  notes?: string;
  shiftId?: string | null;
  channel?: SaleChannel;
  delivery?: DeliveryInput;
  createdAt?: string;
}): SalePayload {
  const customer = input.customer
    ? Object.fromEntries(
        Object.entries({ id: input.customer.id, name: input.customer.name, phone: input.customer.phone, email: input.customer.email, address: input.customer.address })
          .filter(([, v]) => typeof v === "string" && v.trim() !== "")
          .map(([k, v]) => [k, (v as string).trim()]),
      )
    : undefined;
  return {
    clientRef: input.clientRef,
    ...(input.shiftId ? { shiftId: input.shiftId } : {}),
    channel: input.channel ?? "POS_COUNTER",
    ...(customer && Object.keys(customer).length ? { customer } : {}),
    items: input.lines.map((l) => ({
      productId: l.productId,
      ...(l.variantId ? { variantId: l.variantId } : {}),
      quantity: l.quantity,
      ...(l.unitPrice !== l.listPrice ? { unitPrice: l.unitPrice } : {}),
      ...(l.lineDiscount > 0 ? { lineDiscount: l.lineDiscount } : {}),
    })),
    ...(input.discount > 0 ? { discount: input.discount } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.delivery ? { delivery: input.delivery } : {}),
    payments: input.tenders
      .filter((t) => t.amount > 0)
      .map((t) => ({ method: t.method, amount: Math.round(t.amount), ...(t.reference?.trim() ? { reference: t.reference.trim() } : {}) })),
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  };
}

export const WALK_IN_NAME = "Walk-in Customer";

/** Local equivalent of server BillData for offline / provisional printing. */
export function buildLocalBill(input: {
  lines: CartLine[];
  discount: number;
  vat: VatConfig;
  /** posConfig.taxInvoice (VAT on + store PAN). */
  taxInvoice: boolean;
  tenders: Tender[];
  customer?: CartCustomer | null;
  cashierName: string;
  store: StoreProfile;
  footer?: string;
  deliveryCharge?: number;
  allowShortfall?: boolean;
  channel?: string;
  createdAt?: string;
}): Omit<BillData, "printableRef"> {
  const totals = cartTotals(input.lines, input.discount, input.vat, input.deliveryCharge);
  const tender = summariseTenders(input.tenders.filter((t) => t.amount > 0), totals.total, { allowShortfall: input.allowShortfall });
  return {
    createdAt: input.createdAt ?? new Date().toISOString(),
    cashierName: input.cashierName,
    customer: { name: input.customer?.name?.trim() || WALK_IN_NAME, phone: input.customer?.phone?.trim() || null },
    items: input.lines.map((l, i) => ({
      name: l.variantName ? `${l.name} — ${l.variantName}` : l.name,
      sku: l.sku,
      qty: l.quantity,
      unitPrice: l.unitPrice,
      lineDiscount: totals.lines[i].lineDiscount,
      vatApplicable: l.vatApplicable,
      lineTotal: totals.lines[i].lineTotal,
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryCharge: totals.deliveryCharge,
    taxableAmount: totals.taxableAmount,
    vatRate: input.vat.enabled ? input.vat.rate : 0,
    vatAmount: totals.vatAmount,
    vatEnabled: input.vat.enabled,
    taxInvoice: input.vat.enabled && input.taxInvoice,
    total: totals.total,
    payments: tender.booked.map((t) => ({ method: t.method, amount: t.booked, reference: t.reference?.trim() || null })),
    tendered: tender.tendered,
    change: tender.change,
    due: tender.due,
    footer: input.footer ?? "",
    store: input.store,
    channel: input.channel,
  };
}
