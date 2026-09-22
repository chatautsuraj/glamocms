/**
 * Browser local commerce store — used when Nest API is offline (e.g. Vercel).
 * Persists customers, orders, products + stock so Products / Inventory / POS / All sales work.
 */

import type { AnalyticsSummary, ApiCustomer, ApiOrder, ApiProduct } from "@/lib/commerce-client";

const KEY = "glamo-local-commerce-v1";
const MAX_ORDERS = 300;
const MAX_PAYMENTS = 300;

type LocalTillShift = {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number;
  closingCash?: number | null;
  expectedCash?: number | null;
  status: string;
  notes?: string | null;
};

type LocalSaleReturn = {
  id: string;
  orderId: string;
  amount: number;
  reason?: string;
  createdAt: string;
  lines?: Array<{ productId: string; qty: number }>;
};

type LocalPurchaseReceipt = {
  id: string;
  supplierName: string;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  lines: Array<{ productId: string; qty: number; unitCost: number; product?: { name: string } }>;
};

type LocalPayment = {
  id: string;
  orderId?: string;
  provider: string;
  externalRef?: string;
  amount: number;
  status: string;
  createdAt: string;
};

type LocalStore = {
  customers: ApiCustomer[];
  orders: ApiOrder[];
  products: ApiProduct[];
  /** Absolute stock for catalog products adjusted locally */
  stockOverrides: Record<string, number>;
  /** Last purchase cost by product id (for local margin reports) */
  costOverrides: Record<string, number>;
  tillShifts: LocalTillShift[];
  returns: LocalSaleReturn[];
  purchaseReceipts: LocalPurchaseReceipt[];
  payments: LocalPayment[];
};

/** In-memory copy so POS sales don't re-parse localStorage on every write. */
let memory: LocalStore | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function empty(): LocalStore {
  return {
    customers: [],
    orders: [],
    products: [],
    stockOverrides: {},
    costOverrides: {},
    tillShifts: [],
    returns: [],
    purchaseReceipts: [],
    payments: [],
  };
}

function stripHeavyImages(images: string[] | undefined): string[] {
  if (!Array.isArray(images) || !images.length) return [];
  // data: URLs blow up localStorage and freeze JSON.stringify on every sale
  return images.filter((img) => typeof img === "string" && !img.startsWith("data:")).slice(0, 1);
}

function slimForPersist(store: LocalStore): LocalStore {
  return {
    ...store,
    orders: store.orders.slice(0, MAX_ORDERS),
    payments: store.payments.slice(0, MAX_PAYMENTS),
    products: store.products.map((p) => ({
      ...p,
      images: stripHeavyImages(p.images),
    })),
  };
}

function readFromDisk(): LocalStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<LocalStore>;
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      stockOverrides:
        parsed.stockOverrides && typeof parsed.stockOverrides === "object"
          ? parsed.stockOverrides
          : {},
      costOverrides:
        parsed.costOverrides && typeof parsed.costOverrides === "object"
          ? parsed.costOverrides
          : {},
      tillShifts: Array.isArray(parsed.tillShifts) ? parsed.tillShifts : [],
      returns: Array.isArray(parsed.returns) ? parsed.returns : [],
      purchaseReceipts: Array.isArray(parsed.purchaseReceipts) ? parsed.purchaseReceipts : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    };
  } catch {
    return empty();
  }
}

function read(): LocalStore {
  if (!memory) {
    memory = readFromDisk();
    // One-time slim: old sessions may have huge data: image URLs that freeze every sale.
    let dirty = false;
    memory.products = memory.products.map((p) => {
      const images = stripHeavyImages(p.images);
      if (images.length !== (p.images?.length ?? 0)) dirty = true;
      return images === p.images ? p : { ...p, images };
    });
    if (memory.orders.length > MAX_ORDERS) {
      memory.orders = memory.orders.slice(0, MAX_ORDERS);
      dirty = true;
    }
    if (dirty) write(memory);
  }
  return memory;
}

function flushPersist() {
  if (typeof window === "undefined" || !memory) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(slimForPersist(memory)));
  } catch {
    /* quota — keep memory; next sale still works */
  }
}

function write(store: LocalStore) {
  memory = store;
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  // Debounce disk writes so multi-line sales don't stringify repeatedly on the hot path.
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const run = () => flushPersist();
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 800 });
    } else {
      run();
    }
  }, 50);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** DDMMYYYY in local time. */
export function orderDateStamp(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

/**
 * Order number: O + daily serial (3 digits) + DDMMYYYY
 * e.g. O00118092026
 */
export function nextLocalOrderNumber(existing: { id: string }[], d = new Date()): string {
  const datePart = orderDateStamp(d);
  const re = new RegExp(`^O(\\d+)${datePart}$`, "i");
  let max = 0;
  for (const o of existing) {
    const m = String(o.id).match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  }
  const serial = String(max + 1).padStart(3, "0");
  return `O${serial}${datePart}`;
}

/** Safe filename from order number. */
export function orderNumberFileSlug(orderId: string): string {
  return String(orderId).replace(/[^a-zA-Z0-9_-]/g, "") || "order";
}

export type LocalCustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  sourceChannel?: string;
  deliveryAddress?: string;
  notes?: string;
};

export function localListCustomers(phone?: string): ApiCustomer[] {
  let list = read().customers;
  if (phone) {
    const q = phone.trim();
    list = list.filter((c) => (c.phone ?? "").includes(q));
  }
  return [...list].sort(
    (a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );
}

export function localCreateCustomer(input: LocalCustomerInput): ApiCustomer {
  const store = read();
  const phone = input.phone?.trim() || null;
  if (phone) {
    const existing = store.customers.find((c) => c.phone === phone);
    if (existing) {
      const updated: ApiCustomer = {
        ...existing,
        name: input.name.trim() || existing.name,
        sourceChannel: input.sourceChannel ?? existing.sourceChannel,
        deliveryAddress: input.deliveryAddress?.trim() || existing.deliveryAddress,
        notes: input.notes?.trim() || existing.notes,
      };
      store.customers = store.customers.map((c) => (c.id === existing.id ? updated : c));
      write(store);
      return updated;
    }
  }
  const customer: ApiCustomer = {
    id: uid("cust"),
    name: input.name.trim(),
    phone,
    email: input.email?.trim() || null,
    sourceChannel: input.sourceChannel ?? "store",
    deliveryAddress: input.deliveryAddress?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: new Date().toISOString(),
    _count: { orders: 0 },
  };
  store.customers = [customer, ...store.customers];
  write(store);
  return customer;
}

export type LocalProductInput = {
  name: string;
  sku: string;
  price: number;
  mrp?: number;
  stock?: number;
  category?: string;
  brand?: string;
  size?: string;
  shade?: string;
  images?: string[];
  reorderAt?: number;
  galla?: boolean;
  vatApplicable?: boolean;
  isTester?: boolean;
  barcode?: string;
};

/** Merge catalog/API products with locally created products and stock overrides. */
export function mergeProductsWithLocal(remote: ApiProduct[]): ApiProduct[] {
  const store = read();
  const map = new Map<string, ApiProduct>();
  const skuOwner = new Map<string, string>();

  for (const p of remote) {
    const override = store.stockOverrides[p.id];
    map.set(p.id, {
      ...p,
      stock: typeof override === "number" ? override : p.stock,
    });
    skuOwner.set(p.sku.toLowerCase(), p.id);
  }

      // Prefer local SKU ownership if catalog has same SKU — also keep barcode on updates
      for (const p of store.products) {
        const skuKey = p.sku.toLowerCase();
        const oldId = skuOwner.get(skuKey);
        if (oldId && oldId !== p.id) map.delete(oldId);
        map.set(p.id, p);
        skuOwner.set(skuKey, p.id);
      }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function localCreateProduct(input: LocalProductInput): ApiProduct {
  const store = read();
  const sku = input.sku.trim();
  const existing = store.products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
  if (existing) {
    const updated: ApiProduct = {
      ...existing,
      name: input.name.trim() || existing.name,
      price: Number(input.price) || existing.price,
      mrp: input.mrp ?? existing.mrp,
      stock: input.stock != null ? Math.max(0, Math.floor(Number(input.stock))) : existing.stock,
      category: input.category?.trim() || existing.category,
      brand: input.brand?.trim() || existing.brand,
      size: input.size?.trim() || existing.size,
      shade: input.shade?.trim() || existing.shade,
      images: input.images?.length ? input.images : existing.images,
      reorderAt: input.reorderAt ?? existing.reorderAt,
      galla: input.galla ?? existing.galla,
      vatApplicable: input.vatApplicable ?? existing.vatApplicable,
      isTester: input.isTester ?? existing.isTester,
      barcode: input.barcode?.trim() || existing.barcode || existing.sku,
      updatedAt: new Date().toISOString(),
    };
    store.products = store.products.map((p) => (p.id === existing.id ? updated : p));
    write(store);
    return updated;
  }

  const product: ApiProduct = {
    id: uid("prod"),
    name: input.name.trim(),
    sku,
    price: Number(input.price) || 0,
    mrp: input.mrp ?? (Number(input.price) || 0),
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    category: input.category?.trim() || null,
    brand: input.brand?.trim() || null,
    size: input.size?.trim() || null,
    shade: input.shade?.trim() || null,
    images: input.images ?? [],
    batchNumber: null,
    expiresOn: null,
    isTester: input.isTester === true,
    reorderAt: input.reorderAt ?? 5,
    galla: input.galla !== false,
    vatApplicable: input.vatApplicable === true,
    barcode: input.barcode?.trim() || sku,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.products = [product, ...store.products];
  write(store);
  return product;
}

export function localUpdateProduct(
  id: string,
  patch: Partial<LocalProductInput> & { stock?: number },
  base?: ApiProduct | null,
): ApiProduct | null {
  const store = read();
  const idx = store.products.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const existing = store.products[idx];
    const updated: ApiProduct = {
      ...existing,
      name: patch.name?.trim() || existing.name,
      sku: patch.sku?.trim() || existing.sku,
      price: patch.price != null ? Number(patch.price) : existing.price,
      mrp: patch.mrp != null ? Number(patch.mrp) : existing.mrp,
      stock: patch.stock != null ? Math.max(0, Math.floor(Number(patch.stock))) : existing.stock,
      category: patch.category !== undefined ? patch.category.trim() || null : existing.category,
      brand: patch.brand !== undefined ? patch.brand.trim() || null : existing.brand,
      size: patch.size !== undefined ? patch.size.trim() || null : existing.size,
      shade: patch.shade !== undefined ? patch.shade.trim() || null : existing.shade,
      images: patch.images ?? existing.images,
      reorderAt: patch.reorderAt ?? existing.reorderAt,
      galla: patch.galla ?? existing.galla,
      vatApplicable: patch.vatApplicable ?? existing.vatApplicable,
      isTester: patch.isTester ?? existing.isTester,
      updatedAt: new Date().toISOString(),
    };
    store.products[idx] = updated;
    write(store);
    return updated;
  }

  if (base) {
    const updated: ApiProduct = {
      ...base,
      name: patch.name?.trim() || base.name,
      price: patch.price != null ? Number(patch.price) : base.price,
      mrp: patch.mrp != null ? Number(patch.mrp) : base.mrp,
      stock: patch.stock != null ? Math.max(0, Math.floor(Number(patch.stock))) : base.stock,
      category: patch.category !== undefined ? patch.category.trim() || null : base.category,
      brand: patch.brand !== undefined ? patch.brand.trim() || null : base.brand,
      size: patch.size !== undefined ? patch.size.trim() || null : base.size,
      shade: patch.shade !== undefined ? patch.shade.trim() || null : base.shade,
      images: patch.images ?? base.images,
      reorderAt: patch.reorderAt ?? base.reorderAt,
      galla: patch.galla ?? base.galla,
      vatApplicable: patch.vatApplicable ?? base.vatApplicable,
      isTester: patch.isTester ?? base.isTester,
      updatedAt: new Date().toISOString(),
    };
    if (patch.stock != null) {
      store.stockOverrides[id] = updated.stock;
    }
    // Shadow-copy catalog edits so they survive reload
    store.products = [updated, ...store.products.filter((p) => p.id !== id)];
    write(store);
    return updated;
  }

  if (patch.stock != null) {
    store.stockOverrides[id] = Math.max(0, Math.floor(Number(patch.stock)));
    write(store);
  }
  return null;
}

export function localDeleteProduct(id: string): boolean {
  const store = read();
  const before = store.products.length;
  store.products = store.products.filter((p) => p.id !== id);
  delete store.stockOverrides[id];
  write(store);
  return store.products.length < before;
}

export function localSetStock(productId: string, absoluteStock: number, baseProduct?: ApiProduct): ApiProduct {
  const store = read();
  const stock = Math.max(0, Math.floor(absoluteStock));
  const idx = store.products.findIndex((p) => p.id === productId);
  if (idx >= 0) {
    const updated = { ...store.products[idx], stock, updatedAt: new Date().toISOString() };
    store.products[idx] = updated;
    write(store);
    return updated;
  }
  store.stockOverrides[productId] = stock;
  write(store);
  if (baseProduct) return { ...baseProduct, stock };
  return {
    id: productId,
    name: productId,
    sku: productId,
    price: 0,
    stock,
    category: null,
    images: [],
    brand: null,
    shade: null,
    batchNumber: null,
    expiresOn: null,
    isTester: false,
  };
}

export function localAdjustStockFromCurrent(
  productId: string,
  currentStock: number,
  delta: number,
  baseProduct?: ApiProduct,
): ApiProduct {
  return localSetStock(productId, Math.max(0, currentStock + delta), baseProduct);
}

function localAdjustStockRelative(
  productId: string,
  qty: number,
  knownStock?: number,
  store = read(),
  persist = true,
) {
  const idx = store.products.findIndex((p) => p.id === productId);
  if (idx >= 0) {
    const p = store.products[idx];
    store.products[idx] = {
      ...p,
      stock: Math.max(0, p.stock + qty),
      updatedAt: new Date().toISOString(),
    };
    if (persist) write(store);
    return;
  }
  if (typeof store.stockOverrides[productId] === "number") {
    store.stockOverrides[productId] = Math.max(0, store.stockOverrides[productId] + qty);
    if (persist) write(store);
    return;
  }
  if (typeof knownStock === "number") {
    store.stockOverrides[productId] = Math.max(0, knownStock + qty);
    if (persist) write(store);
  }
}

export function localListOrders(params?: {
  channel?: string;
  fulfillmentStatus?: string;
}): ApiOrder[] {
  let list = read().orders;
  if (params?.channel) list = list.filter((o) => o.channel === params.channel);
  if (params?.fulfillmentStatus) {
    list = list.filter((o) => o.fulfillmentStatus === params.fulfillmentStatus);
  }
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type LocalOrderInput = {
  channel?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  customerId?: string;
  customer?: { name: string; phone?: string };
  deliveryAddress?: string;
  deliveryNotes?: string;
  amount?: number;
  items?: Array<{
    productId: string;
    qty: number;
    unitPrice?: number;
    name?: string;
    /** Known on-hand stock before this sale (catalog SKUs). */
    currentStock?: number;
  }>;
};

export function localCreateOrder(input: LocalOrderInput): ApiOrder {
  const store = read();
  let customer: ApiOrder["customer"] = null;
  let customerId: string | null = input.customerId ?? null;

  if (customerId && customerId !== "walk-in") {
    const hit = store.customers.find((c) => c.id === customerId);
    if (hit) {
      customer = { id: hit.id, name: hit.name, phone: hit.phone };
      hit._count = { orders: (hit._count?.orders ?? 0) + 1 };
    }
  } else if (input.customer?.name) {
    const created = localCreateCustomer({
      name: input.customer.name,
      phone: input.customer.phone,
      sourceChannel: input.channel ?? "store",
      deliveryAddress: input.deliveryAddress,
    });
    const refreshed = read();
    store.customers = refreshed.customers;
    store.products = refreshed.products;
    store.stockOverrides = refreshed.stockOverrides;
    store.orders = refreshed.orders;
    customerId = created.id;
    customer = { id: created.id, name: created.name, phone: created.phone };
  }

  const items = (input.items ?? []).map((line) => {
    const unit = Number(line.unitPrice ?? 0);
    const qty = Number(line.qty ?? 0);
    return {
      id: uid("item"),
      qty,
      unitPrice: unit,
      lineTotal: unit * qty,
      product: {
        id: line.productId,
        name: line.name ?? line.productId,
        sku: line.productId,
        price: unit,
        stock: 0,
        category: null,
        images: [],
        brand: null,
        shade: null,
        batchNumber: null,
        expiresOn: null,
        isTester: false,
      } satisfies ApiProduct,
    };
  });

  const amount =
    input.amount ?? items.reduce((s, i) => s + Number(i.lineTotal), 0);

  const order: ApiOrder = {
    id: nextLocalOrderNumber(store.orders),
    customerId,
    amount,
    paymentStatus: input.paymentStatus ?? "paid",
    fulfillmentStatus: input.fulfillmentStatus ?? "fulfilled",
    channel: input.channel ?? "store",
    deliveryAssignee: null,
    deliveryAddress: input.deliveryAddress ?? null,
    deliveryNotes: input.deliveryNotes ?? null,
    deliveryScheduledAt: null,
    deliveryPartner: null,
    deliveryExternalId: null,
    createdAt: new Date().toISOString(),
    customer,
    items,
  };

  store.orders = [order, ...store.orders].slice(0, MAX_ORDERS);

  for (const line of input.items ?? []) {
    const qty = Number(line.qty) || 0;
    if (qty > 0) {
      localAdjustStockRelative(line.productId, -qty, line.currentStock, store, false);
    }
  }

  write(store);
  return order;
}

export function localMirrorOrder(order: ApiOrder): void {
  const store = read();
  if (store.orders.some((o) => o.id === order.id)) return;
  store.orders = [order, ...store.orders];
  write(store);
}

export function localGetOrder(id: string): ApiOrder | null {
  return read().orders.find((o) => o.id === id) ?? null;
}

export type LocalOrderPatch = {
  fulfillmentStatus?: string;
  paymentStatus?: string;
  deliveryAssignee?: string | null;
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  deliveryScheduledAt?: string | null;
  deliveryPartner?: string | null;
  deliveryExternalId?: string | null;
};

export function localUpdateOrder(id: string, patch: LocalOrderPatch): ApiOrder | null {
  const store = read();
  const idx = store.orders.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const prev = store.orders[idx];
  const next: ApiOrder = {
    ...prev,
    ...(patch.fulfillmentStatus != null ? { fulfillmentStatus: patch.fulfillmentStatus } : {}),
    ...(patch.paymentStatus != null ? { paymentStatus: patch.paymentStatus } : {}),
    ...(patch.deliveryAssignee !== undefined ? { deliveryAssignee: patch.deliveryAssignee } : {}),
    ...(patch.deliveryAddress !== undefined ? { deliveryAddress: patch.deliveryAddress } : {}),
    ...(patch.deliveryNotes !== undefined ? { deliveryNotes: patch.deliveryNotes } : {}),
    ...(patch.deliveryScheduledAt !== undefined
      ? { deliveryScheduledAt: patch.deliveryScheduledAt }
      : {}),
    ...(patch.deliveryPartner !== undefined ? { deliveryPartner: patch.deliveryPartner } : {}),
    ...(patch.deliveryExternalId !== undefined
      ? { deliveryExternalId: patch.deliveryExternalId }
      : {}),
  };
  store.orders = store.orders.map((o) => (o.id === id ? next : o));
  write(store);
  return next;
}

export function localCancelOrder(id: string): ApiOrder | null {
  const order = localGetOrder(id);
  if (!order || order.fulfillmentStatus === "cancelled") return order;
  // Restock lines
  for (const line of order.items ?? []) {
    const qty = Number(line.qty) || 0;
    if (qty > 0 && line.product?.id) {
      localAdjustStockRelative(line.product.id, qty);
    }
  }
  return localUpdateOrder(id, { fulfillmentStatus: "cancelled" });
}

export function localAnalytics(lowStockCount = 0): AnalyticsSummary {
  const orders = localListOrders();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startToday - 6 * 24 * 60 * 60 * 1000;

  let todaySales = 0;
  let weekSales = 0;
  let paidOrderCount = 0;
  let pendingDeliveries = 0;
  const byFulfillment: Record<string, number> = {};
  const byChannel: Record<string, number> = {};

  for (const o of orders) {
    const amt = Number(o.amount) || 0;
    const t = new Date(o.createdAt).getTime();
    if (t >= startToday) todaySales += amt;
    if (t >= weekAgo) weekSales += amt;
    if (o.paymentStatus === "paid" || o.paymentStatus === "partial") paidOrderCount += 1;
    if (
      o.fulfillmentStatus === "confirmed" ||
      o.fulfillmentStatus === "packed" ||
      o.fulfillmentStatus === "out_for_delivery"
    ) {
      pendingDeliveries += 1;
    }
    byFulfillment[o.fulfillmentStatus] = (byFulfillment[o.fulfillmentStatus] ?? 0) + 1;
    byChannel[o.channel] = (byChannel[o.channel] ?? 0) + amt;
  }

  return {
    todaySales,
    weekSales,
    orderCount: orders.length,
    pendingDeliveries,
    lowStockCount,
    paidOrderCount,
    byFulfillment,
    byChannel,
    recentOrders: orders.slice(0, 8),
  };
}

/** —— Till / returns / purchase / payments / reports (browser-only until Nest is hosted) —— */

export function localTillStatus() {
  const shifts = [...read().tillShifts].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const current = shifts.find((s) => s.status === "open") ?? null;
  return { current, shifts };
}

export function localTillOpen(dto: {
  cashierName: string;
  openingFloat?: number;
  notes?: string;
}) {
  const store = read();
  if (store.tillShifts.some((s) => s.status === "open")) {
    throw new Error("A till shift is already open — close it first");
  }
  const shift: LocalTillShift = {
    id: uid("till"),
    cashierName: dto.cashierName.trim() || "Cashier",
    openedAt: new Date().toISOString(),
    openingFloat: Number(dto.openingFloat) || 0,
    status: "open",
    notes: dto.notes ?? null,
  };
  store.tillShifts = [shift, ...store.tillShifts];
  write(store);
  return shift;
}

export function localTillClose(dto: { id: string; closingCash: number; notes?: string }) {
  const store = read();
  const shift = store.tillShifts.find((s) => s.id === dto.id);
  if (!shift) throw new Error("Till shift not found");
  if (shift.status !== "open") throw new Error("Shift already closed");

  const since = new Date(shift.openedAt).getTime();
  const salesCash = store.orders
    .filter(
      (o) =>
        o.channel === "store" &&
        new Date(o.createdAt).getTime() >= since &&
        o.fulfillmentStatus !== "cancelled" &&
        (o.paymentStatus === "paid" || o.paymentStatus === "partial"),
    )
    .reduce((s, o) => s + Number(o.amount), 0);
  const expected = shift.openingFloat + salesCash;
  const closed: LocalTillShift = {
    ...shift,
    status: "closed",
    closedAt: new Date().toISOString(),
    closingCash: Number(dto.closingCash) || 0,
    expectedCash: expected,
    notes: [shift.notes, dto.notes].filter(Boolean).join(" | ") || null,
  };
  store.tillShifts = store.tillShifts.map((s) => (s.id === dto.id ? closed : s));
  write(store);
  return closed;
}

export function localListReturns() {
  return [...read().returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function localCreateReturn(dto: {
  orderId: string;
  reason?: string;
  items?: Array<{ productId: string; qty: number }>;
}) {
  const store = read();
  const order = store.orders.find((o) => o.id === dto.orderId);
  if (!order) throw new Error("Order not found");
  if (order.fulfillmentStatus === "cancelled") {
    throw new Error("Cannot return a cancelled order");
  }

  const lines =
    dto.items?.length
      ? dto.items
      : (order.items ?? []).map((i) => ({
          productId: i.product?.id ?? "",
          qty: i.qty,
        })).filter((l) => l.productId);

  let amount = 0;
  for (const line of lines) {
    const sold = order.items?.find((i) => i.product?.id === line.productId);
    const unit = Number(sold?.unitPrice ?? 0);
    amount += unit * line.qty;
    localAdjustStockRelative(line.productId, line.qty);
  }

  const row: LocalSaleReturn = {
    id: uid("ret"),
    orderId: order.id,
    amount,
    reason: dto.reason,
    createdAt: new Date().toISOString(),
    lines,
  };

  const refreshed = read();
  refreshed.returns = [row, ...refreshed.returns];
  write(refreshed);

  const full =
    lines.length === (order.items?.length ?? 0) &&
    lines.every((l) => {
      const sold = order.items?.find((i) => i.product?.id === l.productId);
      return sold && l.qty === sold.qty;
    });
  if (full) {
    localUpdateOrder(order.id, {
      fulfillmentStatus: "cancelled",
      paymentStatus: "cancelled",
      deliveryNotes: [order.deliveryNotes, `Returned: ${row.id}`].filter(Boolean).join(" | "),
    });
  } else {
    localUpdateOrder(order.id, {
      deliveryNotes: [order.deliveryNotes, `Partial return ${row.id}`].filter(Boolean).join(" | "),
    });
  }
  return row;
}

export function localListPurchaseReceipts() {
  return [...read().purchaseReceipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function localReceivePurchase(dto: {
  supplierName: string;
  reference?: string;
  notes?: string;
  lines: Array<{ productId: string; qty: number; unitCost?: number }>;
}) {
  if (!dto.lines?.length) throw new Error("At least one line required");
  const store = read();
  const lines = dto.lines.map((l) => {
    const product =
      store.products.find((p) => p.id === l.productId) ||
      mergeProductsWithLocal([]).find((p) => p.id === l.productId);
    localAdjustStockRelative(l.productId, l.qty, product?.stock);
    if (l.unitCost != null && l.unitCost > 0) {
      const s = read();
      s.costOverrides[l.productId] = Number(l.unitCost);
      write(s);
    }
    return {
      productId: l.productId,
      qty: l.qty,
      unitCost: Number(l.unitCost) || 0,
      product: { name: product?.name ?? l.productId },
    };
  });

  const receipt: LocalPurchaseReceipt = {
    id: uid("po"),
    supplierName: dto.supplierName.trim(),
    reference: dto.reference ?? null,
    notes: dto.notes ?? null,
    createdAt: new Date().toISOString(),
    lines,
  };
  const next = read();
  next.purchaseReceipts = [receipt, ...next.purchaseReceipts];
  write(next);
  return receipt;
}

export function localConfirmPayment(dto: {
  orderId?: string;
  provider?: string;
  externalRef?: string;
  amount?: number;
}) {
  const store = read();
  let amount = dto.amount ?? 0;
  if (dto.orderId) {
    const order = store.orders.find((o) => o.id === dto.orderId);
    if (order) {
      if (!amount) amount = Number(order.amount);
      localUpdateOrder(dto.orderId, { paymentStatus: "paid" });
    }
  }
  const payment: LocalPayment = {
    id: uid("pay"),
    orderId: dto.orderId,
    provider: dto.provider ?? "fonepay",
    externalRef: dto.externalRef,
    amount,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  const next = read();
  next.payments = [payment, ...next.payments];
  write(next);
  return payment;
}

export function localRetailReport(kind: "margin" | "cashier", days = 30) {
  const since = Date.now() - Math.min(Math.max(days, 1), 365) * 86400000;
  const store = read();
  const orders = store.orders.filter(
    (o) =>
      new Date(o.createdAt).getTime() >= since &&
      o.fulfillmentStatus !== "cancelled" &&
      o.paymentStatus !== "cancelled",
  );

  if (kind === "cashier") {
    const shifts = store.tillShifts
      .filter((s) => new Date(s.openedAt).getTime() >= since)
      .map((s) => ({
        ...s,
        variance:
          s.closingCash != null && s.expectedCash != null
            ? Number(s.closingCash) - Number(s.expectedCash)
            : null,
      }));
    const byDay = new Map<string, { count: number; amount: number; paid: number }>();
    for (const o of orders.filter((x) => x.channel === "store")) {
      const day = o.createdAt.slice(0, 10);
      const row = byDay.get(day) ?? { count: 0, amount: 0, paid: 0 };
      row.count += 1;
      row.amount += Number(o.amount);
      if (o.paymentStatus === "paid" || o.paymentStatus === "partial") row.paid += Number(o.amount);
      byDay.set(day, row);
    }
    return {
      days,
      shifts,
      daily: [...byDay.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  const bySku = new Map<
    string,
    { productId: string; sku: string; name: string; qty: number; revenue: number; cost: number; margin: number }
  >();
  for (const o of orders) {
    for (const item of o.items ?? []) {
      const pid = item.product?.id ?? "";
      if (!pid) continue;
      const row = bySku.get(pid) ?? {
        productId: pid,
        sku: item.product?.sku ?? pid,
        name: item.product?.name ?? pid,
        qty: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
      };
      const rev = Number(item.lineTotal);
      const unitCost = store.costOverrides[pid] ?? 0;
      row.qty += item.qty;
      row.revenue += rev;
      row.cost += unitCost * item.qty;
      row.margin = row.revenue - row.cost;
      bySku.set(pid, row);
    }
  }
  const rows = [...bySku.values()].sort((a, b) => b.margin - a.margin);
  const totals = rows.reduce(
    (s, r) => ({
      revenue: s.revenue + r.revenue,
      cost: s.cost + r.cost,
      margin: s.margin + r.margin,
      qty: s.qty + r.qty,
    }),
    { revenue: 0, cost: 0, margin: 0, qty: 0 },
  );
  return { days, since: new Date(since).toISOString(), totals, rows };
}

export function isApiOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const s = msg.toLowerCase();
  return (
    s.includes("fetch failed") ||
    s.includes("failed to") ||
    s.includes("order failed") ||
    s.includes("stock adjust failed") ||
    s.includes("econnrefused") ||
    s.includes("upstream") ||
    s.includes("502") ||
    s.includes("503") ||
    s.includes("500") ||
    s.includes("network") ||
    s.includes("offline") ||
    s.includes("nest api") ||
    s.includes("request failed") ||
    s.includes("api offline") ||
    s.includes("open till failed") ||
    s.includes("close till failed") ||
    s.includes("return failed") ||
    s.includes("receive failed") ||
    s.includes("payment confirm failed") ||
    s.includes("report failed")
  );
}
