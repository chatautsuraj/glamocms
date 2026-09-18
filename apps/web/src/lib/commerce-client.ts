/**
 * Browser → Next BFF client for Glamo commerce CMS/POS.
 * Falls back to localStorage when Nest API is unreachable (e.g. Vercel without hosted API).
 */

import {
  isApiOfflineError,
  localAdjustStockFromCurrent,
  localAnalytics,
  localCancelOrder,
  localCreateCustomer,
  localCreateOrder,
  localCreateProduct,
  localDeleteProduct,
  localGetOrder,
  localListCustomers,
  localListOrders,
  localMirrorOrder,
  localUpdateOrder,
  localUpdateProduct,
  mergeProductsWithLocal,
  type LocalCustomerInput,
  type LocalOrderInput,
  type LocalOrderPatch,
  type LocalProductInput,
} from "@/lib/local-commerce";

async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === "string"
        ? data.error
        : data?.detail
          ? JSON.stringify(data.detail)
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export type ApiProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string | null;
  images: string[];
  brand: string | null;
  shade: string | null;
  batchNumber: string | null;
  expiresOn: string | null;
  isTester: boolean;
  size?: string | null;
  mrp?: number | null;
  reorderAt?: number;
  galla?: boolean;
  vatApplicable?: boolean;
  barcode?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiOrder = {
  id: string;
  customerId: string | null;
  amount: number | string;
  paymentStatus: string;
  fulfillmentStatus: string;
  channel: string;
  deliveryAssignee: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  deliveryScheduledAt: string | null;
  deliveryPartner: string | null;
  deliveryExternalId: string | null;
  createdAt: string;
  customer?: { id: string; name: string; phone: string | null } | null;
  items?: Array<{
    id: string;
    qty: number;
    unitPrice: number | string;
    lineTotal: number | string;
    product?: ApiProduct;
  }>;
};

export type ApiCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  sourceChannel: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  createdAt?: string;
  _count?: { orders: number };
};

export type AnalyticsSummary = {
  todaySales: number;
  weekSales: number;
  orderCount: number;
  pendingDeliveries: number;
  lowStockCount: number;
  paidOrderCount: number;
  byFulfillment: Record<string, number>;
  byChannel: Record<string, number>;
  recentOrders: ApiOrder[];
};

function toLocalProductInput(body: Record<string, unknown>): LocalProductInput {
  return {
    name: String(body.name ?? "").trim(),
    sku: String(body.sku ?? "").trim(),
    price: Number(body.price) || 0,
    mrp: body.mrp != null ? Number(body.mrp) : undefined,
    stock: body.stock != null ? Number(body.stock) : undefined,
    category: body.category != null ? String(body.category) : undefined,
    brand: body.brand != null ? String(body.brand) : undefined,
    size: body.size != null ? String(body.size) : undefined,
    shade: body.shade != null ? String(body.shade) : undefined,
    images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
    reorderAt: body.reorderAt != null ? Number(body.reorderAt) : undefined,
    galla: body.galla !== false,
    vatApplicable: body.vatApplicable === true,
    isTester: body.isTester === true,
    barcode: body.barcode != null ? String(body.barcode) : undefined,
  };
}

export const commerceClient = {
  listProducts: async (q?: string) => {
    let remote: ApiProduct[] = [];
    try {
      const res = await bff<{ products: ApiProduct[] }>(
        `/api/commerce/products${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      );
      remote = Array.isArray(res.products) ? res.products : [];
    } catch {
      /* API offline — local + empty catalog handled by merge */
    }
    let products = mergeProductsWithLocal(remote);
    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.sku.toLowerCase().includes(needle) ||
          (p.brand ?? "").toLowerCase().includes(needle),
      );
    }
    return { products };
  },
  getProduct: async (id: string) => {
    try {
      return await bff<{ product: ApiProduct }>(`/api/commerce/products/${id}`);
    } catch (e) {
      if (!isApiOfflineError(e)) throw e;
      const hit = mergeProductsWithLocal([]).find((p) => p.id === id || p.sku === id);
      if (!hit) throw e;
      return { product: hit };
    }
  },
  createProduct: async (body: Record<string, unknown>) => {
    let remote: ApiProduct | null = null;
    try {
      const res = await bff<{ product: ApiProduct }>("/api/commerce/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
      remote = res.product ?? null;
    } catch (e) {
      if (!isApiOfflineError(e)) throw e;
    }
    const local = localCreateProduct(toLocalProductInput(body));
    return { product: remote ?? local };
  },
  updateProduct: async (id: string, body: Record<string, unknown>) => {
    let remote: ApiProduct | null = null;
    try {
      const res = await bff<{ product: ApiProduct }>(`/api/commerce/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      remote = res.product ?? null;
    } catch (e) {
      if (!isApiOfflineError(e)) throw e;
    }

    let base = remote;
    if (!base) {
      let catalog: ApiProduct[] = [];
      try {
        const res = await bff<{ products: ApiProduct[] }>("/api/commerce/products");
        catalog = Array.isArray(res.products) ? res.products : [];
      } catch {
        /* offline catalog empty — merge still has local */
      }
      base = mergeProductsWithLocal(catalog).find((p) => p.id === id) ?? null;
    }

    const input = toLocalProductInput({
      ...body,
      sku: body.sku ?? base?.sku ?? id,
      name: body.name ?? base?.name ?? id,
      price: body.price ?? base?.price ?? 0,
    });
    const local = localUpdateProduct(id, input, base);
    if (!local && !remote) throw new Error("Failed to update product");
    return { product: remote ?? local! };
  },
  deleteProduct: async (id: string) => {
    try {
      await bff<{ ok: boolean }>(`/api/commerce/products/${id}`, { method: "DELETE" });
    } catch (e) {
      if (!isApiOfflineError(e)) throw e;
    }
    localDeleteProduct(id);
    return { ok: true };
  },

  adjustStock: async (body: {
    productId: string;
    qty: number;
    reason?: string;
    currentStock?: number;
  }) => {
    try {
      return await bff<{ product: ApiProduct }>("/api/commerce/inventory/adjust", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (!isApiOfflineError(e)) throw e;
      const current = body.currentStock ?? 0;
      const product = localAdjustStockFromCurrent(body.productId, current, body.qty);
      return { product };
    }
  },

  listCustomers: async (phone?: string) => {
    let remote: ApiCustomer[] = [];
    try {
      const res = await bff<{ customers: ApiCustomer[] }>(
        `/api/commerce/customers${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`,
      );
      remote = Array.isArray(res.customers) ? res.customers : [];
    } catch {
      /* API offline */
    }
    const local = localListCustomers(phone);
    const map = new Map<string, ApiCustomer>();
    for (const c of remote) map.set(c.id, c);
    for (const c of local) {
      if (!map.has(c.id)) map.set(c.id, c);
      else if (c.phone && !remote.some((r) => r.phone === c.phone)) map.set(c.id, c);
    }
    // Also include local by phone if remote empty
    for (const c of local) {
      const dup = [...map.values()].find((x) => x.phone && c.phone && x.phone === c.phone);
      if (!dup) map.set(c.id, c);
    }
    return {
      customers: [...map.values()].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
      ),
    };
  },
  createCustomer: async (body: LocalCustomerInput) => {
    // Always persist locally so Customers / Phone order work without Nest.
    let remote: ApiCustomer | null = null;
    try {
      const res = await bff<{ customer: ApiCustomer }>("/api/commerce/customers", {
        method: "POST",
        body: JSON.stringify(body),
      });
      remote = res.customer ?? null;
    } catch (e) {
      if (!isApiOfflineError(e)) throw e;
    }
    const local = localCreateCustomer(body);
    return { customer: remote ?? local };
  },

  listOrders: async (params?: { channel?: string; fulfillmentStatus?: string }) => {
    let remote: ApiOrder[] = [];
    try {
      const sp = new URLSearchParams();
      if (params?.channel) sp.set("channel", params.channel);
      if (params?.fulfillmentStatus) sp.set("fulfillmentStatus", params.fulfillmentStatus);
      const q = sp.toString();
      const res = await bff<{ orders: ApiOrder[] }>(`/api/commerce/orders${q ? `?${q}` : ""}`);
      remote = Array.isArray(res.orders) ? res.orders : [];
    } catch {
      /* API offline */
    }
    const local = localListOrders(params);
    const map = new Map<string, ApiOrder>();
    for (const o of remote) map.set(o.id, o);
    for (const o of local) map.set(o.id, o);
    return {
      orders: [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  },
  getOrder: async (id: string) => {
    try {
      const res = await bff<{ order: ApiOrder }>(`/api/commerce/orders/${id}`);
      if (res.order) localMirrorOrder(res.order);
      return res;
    } catch (e) {
      if (!isApiOfflineError(e)) {
        const local = localGetOrder(id);
        if (local) return { order: local };
        throw e;
      }
      const order = localGetOrder(id);
      if (!order) throw new Error("Order not found");
      return { order };
    }
  },
  createOrder: async (body: Record<string, unknown>) => {
    try {
      const res = await bff<{ ok: boolean; order: ApiOrder }>("/api/commerce/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.order) localMirrorOrder(res.order);
      return res;
    } catch (e) {
      if (!isApiOfflineError(e)) throw e;
      const order = localCreateOrder(body as LocalOrderInput);
      return { ok: true, order };
    }
  },
  updateOrder: async (id: string, body: Record<string, unknown>) => {
    const patch = body as LocalOrderPatch;
    try {
      const res = await bff<{ order: ApiOrder }>(`/api/commerce/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (res.order) {
        // Keep local copy in sync (overwrite)
        const storeOrder = localGetOrder(id);
        if (storeOrder) localUpdateOrder(id, {
          fulfillmentStatus: res.order.fulfillmentStatus,
          paymentStatus: res.order.paymentStatus,
          deliveryAssignee: res.order.deliveryAssignee,
          deliveryAddress: res.order.deliveryAddress,
          deliveryNotes: res.order.deliveryNotes,
          deliveryScheduledAt: res.order.deliveryScheduledAt,
          deliveryPartner: res.order.deliveryPartner,
          deliveryExternalId: res.order.deliveryExternalId,
        });
        else localMirrorOrder(res.order);
        return res;
      }
    } catch (e) {
      if (!isApiOfflineError(e)) {
        // Order may exist only locally
        const local = localUpdateOrder(id, patch);
        if (local) return { order: local };
        throw e;
      }
    }
    const order = localUpdateOrder(id, patch);
    if (!order) throw new Error("Order not found");
    return { order };
  },
  cancelOrder: async (id: string) => {
    try {
      const res = await bff<{ order: ApiOrder }>(`/api/commerce/orders/${id}/cancel`, {
        method: "POST",
      });
      if (res.order) localUpdateOrder(id, { fulfillmentStatus: "cancelled" });
      return res;
    } catch (e) {
      if (!isApiOfflineError(e)) {
        const local = localCancelOrder(id);
        if (local) return { order: local };
        throw e;
      }
      const order = localCancelOrder(id);
      if (!order) throw new Error("Order not found");
      return { order };
    }
  },
  dispatchDelivery: async (id: string, body?: Record<string, unknown>) => {
    try {
      const res = await bff<{ order: ApiOrder; partner?: unknown }>(
        `/api/commerce/orders/${id}/dispatch`,
        {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        },
      );
      if (res.order) {
        localUpdateOrder(id, {
          fulfillmentStatus: res.order.fulfillmentStatus,
          deliveryPartner: res.order.deliveryPartner,
          deliveryExternalId: res.order.deliveryExternalId,
          deliveryAssignee: res.order.deliveryAssignee,
          deliveryAddress: res.order.deliveryAddress,
          deliveryNotes: res.order.deliveryNotes,
          deliveryScheduledAt: res.order.deliveryScheduledAt,
        });
      }
      return res;
    } catch (e) {
      if (!isApiOfflineError(e)) {
        // Fall through to local stub
      } else {
        /* offline */
      }
      const tracking = `MANUAL-${Date.now().toString(36).toUpperCase()}`;
      const order = localUpdateOrder(id, {
        fulfillmentStatus: "out_for_delivery",
        deliveryPartner: "manual",
        deliveryExternalId: tracking,
        ...(body?.deliveryAssignee != null
          ? { deliveryAssignee: String(body.deliveryAssignee) }
          : {}),
        ...(body?.deliveryAddress != null
          ? { deliveryAddress: String(body.deliveryAddress) }
          : {}),
      });
      if (!order) throw e instanceof Error ? e : new Error("Order not found");
      return { order, partner: { partner: "manual", tracking } };
    }
  },

  analytics: async () => {
    let remote: AnalyticsSummary | null = null;
    try {
      const res = await bff<{ analytics: AnalyticsSummary }>("/api/commerce/analytics");
      remote = res.analytics;
    } catch {
      /* offline */
    }
    const lowStockCount = remote?.lowStockCount ?? 0;
    const local = localAnalytics(lowStockCount);
    if (!remote) return { analytics: local };

    const byChannel = { ...remote.byChannel };
    for (const [k, v] of Object.entries(local.byChannel)) {
      byChannel[k] = (byChannel[k] ?? 0) + v;
    }
    const byFulfillment = { ...remote.byFulfillment };
    for (const [k, v] of Object.entries(local.byFulfillment)) {
      byFulfillment[k] = (byFulfillment[k] ?? 0) + v;
    }
    return {
      analytics: {
        todaySales: remote.todaySales + local.todaySales,
        weekSales: remote.weekSales + local.weekSales,
        orderCount: remote.orderCount + local.orderCount,
        pendingDeliveries: remote.pendingDeliveries + local.pendingDeliveries,
        lowStockCount: remote.lowStockCount || local.lowStockCount,
        paidOrderCount: remote.paidOrderCount + local.paidOrderCount,
        byFulfillment,
        byChannel,
        recentOrders: [...local.recentOrders, ...remote.recentOrders].slice(0, 10),
      },
    };
  },
};

/** Map API product → shape expected by existing Beauty UI components */
export function apiProductToUi(p: ApiProduct) {
  const image = p.images?.[0] ?? "";
  return {
    id: p.id,
    sku: p.sku,
    barcode: (p.barcode || p.sku || "").trim(),
    name: p.name,
    brand: p.brand ?? "",
    category: p.category ?? "",
    size: p.size ?? "",
    unit: "PCS",
    mrp: Number(p.mrp ?? p.price),
    tradePrice: Number(p.price),
    stock: p.stock,
    reorderAt: p.reorderAt ?? 5,
    galla: p.galla !== false,
    vatApplicable: p.vatApplicable === true,
    tenantId: "glamo",
    image,
    shade: p.shade ?? "",
    batchNumber: p.batchNumber ?? "",
    expiresOn: p.expiresOn ? String(p.expiresOn).slice(0, 10) : "",
    paoMonths: "",
    isTester: p.isTester,
    vat: p.vatApplicable ? 13 : 0,
  };
}
