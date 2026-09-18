/**
 * Browser local commerce store — used when Nest API is offline (e.g. Vercel).
 * Persists customers + orders in localStorage so POS / analytics / sales still work.
 */

import type { AnalyticsSummary, ApiCustomer, ApiOrder, ApiProduct } from "@/lib/commerce-client";

const KEY = "glamo-local-commerce-v1";

type LocalStore = {
  customers: ApiCustomer[];
  orders: ApiOrder[];
};

function empty(): LocalStore {
  return { customers: [], orders: [] };
}

function read(): LocalStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as LocalStore;
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
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
    input.amount ??
    items.reduce((s, i) => s + Number(i.lineTotal), 0);

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
  return order;
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
    s.includes("econnrefused") ||
    s.includes("upstream") ||
    s.includes("502") ||
    s.includes("500") ||
    s.includes("network") ||
    s.includes("offline")
  );
}
