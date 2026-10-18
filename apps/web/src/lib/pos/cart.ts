/** Till cart (in-memory Zustand) + pure builders for the sale payload and offline bill. */
import { create } from "zustand";
import type { BillData, PosProduct, SaleChannel, SaleCustomerInput, SalePayload, StoreProfile, DeliveryInput } from "@/lib/api/types";
import { computeCartTotals, summariseTenders, type CartTotals, type Tender } from "./math";

export interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string | null;
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

export interface CartCustomer extends SaleCustomerInput {
  khataBalance?: number;
}

export function lineFromProduct(p: PosProduct, variantId: string | null): CartLine {
  const v = variantId ? p.variants.find((x) => x.id === variantId) : undefined;
  const price = v ? v.price : p.price;
  return {
    key: `${p.id}:${v?.id ?? ""}`,
    productId: p.id,
    variantId: v?.id ?? null,
    name: p.name,
    variantName: v?.name ?? (p.attributes?.shade || null),
    sku: v?.sku ?? p.sku,
    listPrice: price,
    unitPrice: price,
    quantity: 1,
    lineDiscount: 0,
    vatApplicable: p.vatApplicable,
    stock: v ? v.stock : p.stock,
    trackInventory: p.trackInventory ?? true,
  };
}

interface CartState {
  lines: CartLine[];
  customer: CartCustomer | null;
  discount: number;
  notes: string;
  add: (line: CartLine) => CartLine;
  setQty: (key: string, qty: number) => void;
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
    add(line) {
      const existing = get().lines.find((l) => l.key === line.key);
      if (existing) {
        const next = { ...existing, quantity: existing.quantity + line.quantity };
        set({ lines: get().lines.map((l) => (l.key === line.key ? next : l)) });
        return next;
      }
      set({ lines: [...get().lines, line] });
      return line;
    },
    setQty: (key, qty) => set({ lines: get().lines.map((l) => (l.key === key ? { ...l, quantity: clampInt(qty, 1) } : l)) }),
    setLineDiscount: (key, amount) =>
      set({ lines: get().lines.map((l) => (l.key === key ? { ...l, lineDiscount: Math.min(clampInt(amount), l.unitPrice * l.quantity) } : l)) }),
    setUnitPrice: (key, price) => set({ lines: get().lines.map((l) => (l.key === key ? { ...l, unitPrice: clampInt(price) } : l)) }),
    remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
    setCustomer: (customer) => set({ customer }),
    setDiscount: (d) => set({ discount: clampInt(d) }),
    setNotes: (notes) => set({ notes }),
    clear: () => set({ lines: [], customer: null, discount: 0, notes: "" }),
  }));
}

/** Counter till cart and phone-desk cart are independent. */
export const useTillCart = createCartStore();
export const usePhoneCart = createCartStore();

export function cartTotals(lines: CartLine[], discount: number, vatRate: number, deliveryCharge = 0): CartTotals {
  return computeCartTotals({
    lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, lineDiscount: l.lineDiscount, vatApplicable: l.vatApplicable })),
    discount,
    vatRate,
    deliveryCharge,
  });
}

export function isNamedCustomer(c: CartCustomer | null | undefined) {
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

/** Local equivalent of server BillData for offline / provisional printing. */
export function buildLocalBill(input: {
  lines: CartLine[];
  discount: number;
  vatRate: number;
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
  const totals = cartTotals(input.lines, input.discount, input.vatRate, input.deliveryCharge);
  const tender = summariseTenders(input.tenders.filter((t) => t.amount > 0), totals.total, { allowShortfall: input.allowShortfall, hasNamedCustomer: true });
  return {
    createdAt: input.createdAt ?? new Date().toISOString(),
    cashierName: input.cashierName,
    customer: { name: input.customer?.name?.trim() || "Walk-in Customer", phone: input.customer?.phone?.trim() || null },
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
    vatRate: input.vatRate,
    vatAmount: totals.vatAmount,
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
