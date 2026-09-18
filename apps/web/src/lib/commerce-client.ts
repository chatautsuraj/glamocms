/**
 * Browser → Next BFF client for Glamo commerce CMS/POS.
 */

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

export const commerceClient = {
  listProducts: (q?: string) =>
    bff<{ products: ApiProduct[] }>(
      `/api/commerce/products${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  getProduct: (id: string) => bff<{ product: ApiProduct }>(`/api/commerce/products/${id}`),
  createProduct: (body: Record<string, unknown>) =>
    bff<{ product: ApiProduct }>("/api/commerce/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProduct: (id: string, body: Record<string, unknown>) =>
    bff<{ product: ApiProduct }>(`/api/commerce/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteProduct: (id: string) =>
    bff<{ ok: boolean }>(`/api/commerce/products/${id}`, { method: "DELETE" }),

  adjustStock: (body: { productId: string; qty: number; reason?: string }) =>
    bff<{ product: ApiProduct }>("/api/commerce/inventory/adjust", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCustomers: (phone?: string) =>
    bff<{ customers: ApiCustomer[] }>(
      `/api/commerce/customers${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`,
    ),
  createCustomer: (body: {
    name: string;
    phone?: string;
    email?: string;
    sourceChannel?: string;
  }) =>
    bff<{ customer: ApiCustomer }>("/api/commerce/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listOrders: (params?: { channel?: string; fulfillmentStatus?: string }) => {
    const sp = new URLSearchParams();
    if (params?.channel) sp.set("channel", params.channel);
    if (params?.fulfillmentStatus) sp.set("fulfillmentStatus", params.fulfillmentStatus);
    const q = sp.toString();
    return bff<{ orders: ApiOrder[] }>(`/api/commerce/orders${q ? `?${q}` : ""}`);
  },
  getOrder: (id: string) => bff<{ order: ApiOrder }>(`/api/commerce/orders/${id}`),
  createOrder: (body: Record<string, unknown>) =>
    bff<{ ok: boolean; order: ApiOrder }>("/api/commerce/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateOrder: (id: string, body: Record<string, unknown>) =>
    bff<{ order: ApiOrder }>(`/api/commerce/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  cancelOrder: (id: string) =>
    bff<{ order: ApiOrder }>(`/api/commerce/orders/${id}/cancel`, { method: "POST" }),
  dispatchDelivery: (id: string, body?: Record<string, unknown>) =>
    bff<{ order: ApiOrder; partner?: unknown }>(`/api/commerce/orders/${id}/dispatch`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  analytics: () => bff<{ analytics: AnalyticsSummary }>("/api/commerce/analytics"),
};

/** Map API product → shape expected by existing Beauty UI components */
export function apiProductToUi(p: ApiProduct) {
  const image = p.images?.[0] ?? "";
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.sku,
    name: p.name,
    brand: p.brand ?? "",
    category: p.category ?? "",
    size: p.size ?? "",
    unit: "PCS",
    mrp: Number(p.mrp ?? p.price),
    tradePrice: Number(p.price),
    stock: p.stock,
    reorderAt: p.reorderAt ?? 5,
    vat: 13,
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
