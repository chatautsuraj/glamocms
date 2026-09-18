/**
 * Browser local commerce store — used when Nest API is offline (e.g. Vercel).
 * Persists customers, orders, products + stock so Products / Inventory / POS / All sales work.
 */

import type { AnalyticsSummary, ApiCustomer, ApiOrder, ApiProduct } from "@/lib/commerce-client";

const KEY = "glamo-local-commerce-v1";

type LocalStore = {
  customers: ApiCustomer[];
  orders: ApiOrder[];
  products: ApiProduct[];
  /** Absolute stock for catalog products adjusted locally */
  stockOverrides: Record<string, number>;
};

function empty(): LocalStore {
  return { customers: [], orders: [], products: [], stockOverrides: {} };
}

function read(): LocalStore {
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
    };
  } catch {
    return empty();
  }
}

function write(store: LocalStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store));
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
    mrp: input.mrp ?? Number(input.price) || 0,
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

function localAdjustStockRelative(productId: string, qty: number, knownStock?: number) {
  const store = read();
  const idx = store.products.findIndex((p) => p.id === productId);
  if (idx >= 0) {
    const p = store.products[idx];
    store.products[idx] = {
      ...p,
      stock: Math.max(0, p.stock + qty),
      updatedAt: new Date().toISOString(),
    };
    write(store);
    return;
  }
  if (typeof store.stockOverrides[productId] === "number") {
    store.stockOverrides[productId] = Math.max(0, store.stockOverrides[productId] + qty);
    write(store);
    return;
  }
  if (typeof knownStock === "number") {
    store.stockOverrides[productId] = Math.max(0, knownStock + qty);
    write(store);
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
    id: uid("ord"),
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

  store.orders = [order, ...store.orders];
  write(store);

  for (const line of input.items ?? []) {
    const qty = Number(line.qty) || 0;
    if (qty > 0) {
      localAdjustStockRelative(line.productId, -qty, line.currentStock);
    }
  }

  return order;
}

export function localMirrorOrder(order: ApiOrder): void {
  const store = read();
  if (store.orders.some((o) => o.id === order.id)) return;
  store.orders = [order, ...store.orders];
  write(store);
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
    s.includes("request failed")
  );
}
