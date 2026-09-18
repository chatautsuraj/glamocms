"use client";

import { migrateGlamoCatalog } from "@/lib/catalog-migration";
import type { CatalogProduct } from "@/lib/catalog";
import { saleBlockReason } from "@/lib/cosmetics";
import { mirrorStoreOrderToApi } from "@/lib/commerce-api";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CUSTOMERS,
  PRODUCTS,
  SUPPLIERS,
  ORDERS,
  PURCHASE_ORDERS,
  INVOICES,
  EXPENSES,
  PRICE_LISTS,
  PRICE_LIST_ITEMS,
  CUSTOMER_SPECIAL_PRICES,
} from "@/lib/mock-data";
import {
  FULL_TENANT_FEATURES,
  STARTER_TENANT_FEATURES,
  normalizeFeatureList,
  type FeatureKey,
} from "@/lib/features";

export type Customer = Omit<(typeof CUSTOMERS)[number], "priceListId"> & {
  priceListId?: string;
};
export type Product = CatalogProduct;
export type Supplier = (typeof SUPPLIERS)[number];

export type ProductCategory = {
  id: string;
  name: string;
  tenantId: string;
};

/** Unique product categories per tenant, derived from seed catalog. */
const SEED_CATEGORIES: ProductCategory[] = (() => {
  const seen = new Map<string, ProductCategory>();
  let n = 1;
  for (const p of PRODUCTS) {
    const name = p.category?.trim();
    if (!name) continue;
    const key = `${p.tenantId}::${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.set(key, { id: `cat${n++}`, name, tenantId: p.tenantId });
  }
  return Array.from(seen.values());
})();

export type PriceList = {
  id: string;
  tenantId?: string;
  name: string;
  code: string;
  isDefault?: boolean;
};

export type PriceListItem = {
  id: string;
  priceListId: string;
  productId: string;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

export type CustomerSpecialPrice = {
  id: string;
  tenantId?: string;
  customerId: string;
  productId: string;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

export type InvoiceLineItem = {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
};

export type PurchaseOrder = (typeof PURCHASE_ORDERS)[number] & {
  /** Catalog line items when PO is raised with products; omit/empty for estimate-only. */
  items?: InvoiceLineItem[];
};

export type Order = Omit<(typeof ORDERS)[number], "items"> & {
  /** Catalog line items (may be empty for legacy seed rows). */
  items: InvoiceLineItem[];
  /** Fallback qty count when `items` is empty (seed data). */
  itemCount?: number;
  customerId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
};

export type FulfillOrderInput = {
  items: InvoiceLineItem[];
  paymentStatus?: "PAID" | "UNPAID";
  method?: string;
  splitCash?: number;
  splitQr?: number;
};

export type InvoicePayment = {
  id: string;
  amount: number;
  method: string;
  date: string;
  note?: string;
};

export type Invoice = (typeof INVOICES)[number] & {
  items?: InvoiceLineItem[];
  payments?: InvoicePayment[];
  splitCash?: number;
  splitQr?: number;
  customerId?: string;
};

export type Expense = (typeof EXPENSES)[number];

export type Tenant = {
  id: string;
  name: string;
  shortName: string;
  enabledFeatures: FeatureKey[];
  /**
   * Client-level VAT service. When false, products/invoices/orders/Galla
   * must not charge or expose VAT (totals = subtotal).
   * Defaults to true for existing clients.
   */
  vatEnabled: boolean;
  /** Soft-delete — inactive tenants are hidden from lists */
  active: boolean;
  /** Super admin who onboarded this client */
  createdByUserId?: string | null;
};

/** Demo mock only — plain-text passwords (not production-secure). */
export const DEMO_PASSWORD = "FlowDMS@2024";

export type User = {
  id: string;
  name: string;
  email: string;
  /** Plain text for demo mock — do not use in production. */
  password: string;
  role: string;
  avatar: string;
  status: string;
  active: boolean;
  /**
   * Client staff are locked to one tenant.
   * Super admin uses `null` and switches via `activeTenantId`.
   */
  tenantId: string | null;
  /** Legacy field — unused for new hierarchy (single Super admin). */
  managedTenantIds: string[];
  /** null = inherit all tenant-enabled features */
  enabledFeatures: FeatureKey[] | null;
  /** Staff may edit records (owners/admins always can). Default true. */
  canEdit: boolean;
  /** Staff may delete records (owners/admins always can). Default false for staff. */
  canDelete: boolean;
};

export type Branch = {
  name: string;
  code: string;
  pan: string;
  active: boolean;
  tenantId: string;
};

export const TENANT_HIMALAYAN = "t1";
export const TENANT_POKHARA = "t2";

const SEED_TENANTS: Tenant[] = [
  {
    id: TENANT_HIMALAYAN,
    name: "Glamo Nepal",
    shortName: "Glamo Nepal",
    enabledFeatures: [...FULL_TENANT_FEATURES],
    vatEnabled: false,
    active: true,
    createdByUserId: "u1",
  },
];

const SALES_FEATURES: FeatureKey[] = [
  "dashboard",
  "notifications",
  "sales",
  "galla",
  "orders",
  "customers",
];

const INVENTORY_FEATURES: FeatureKey[] = [
  "dashboard",
  "notifications",
  "products",
  "inventory",
  "purchase",
  "suppliers",
];

const SEED_USERS: User[] = [
  { id: "u7", name: "Glamo Manager", email: "manager@glamonepal.com", password: DEMO_PASSWORD, role: "OWNER", avatar: "GN", status: "Active", active: true, tenantId: TENANT_HIMALAYAN, managedTenantIds: [], enabledFeatures: null, canEdit: true, canDelete: true },
  {
    id: "u1",
    name: "Rajesh Sharma",
    email: "owner@himalayanbeauty.example",
    password: DEMO_PASSWORD,
    role: "PLATFORM_ADMIN",
    avatar: "RS",
    status: "Active",
    active: true,
    tenantId: null,
    managedTenantIds: [],
    enabledFeatures: null,
    canEdit: true,
    canDelete: true,
  },
  {
    id: "u2",
    name: "Prakash Gurung",
    email: "prakash@himalayanbeauty.example",
    password: DEMO_PASSWORD,
    role: "SALES",
    avatar: "PG",
    status: "Active",
    active: true,
    tenantId: TENANT_HIMALAYAN,
    managedTenantIds: [],
    enabledFeatures: [...SALES_FEATURES],
    canEdit: true,
    canDelete: false,
  },
  {
    id: "u3",
    name: "Sita Magar",
    email: "sita@himalayanbeauty.example",
    password: DEMO_PASSWORD,
    role: "SALES",
    avatar: "SM",
    status: "Active",
    active: true,
    tenantId: TENANT_HIMALAYAN,
    managedTenantIds: [],
    enabledFeatures: ["dashboard", "orders", "customers", "notifications"],
    canEdit: true,
    canDelete: false,
  },
  {
    id: "u4",
    name: "Stock Keeper",
    email: "stock@himalayanbeauty.example",
    password: DEMO_PASSWORD,
    role: "WAREHOUSE",
    avatar: "SK",
    status: "Active",
    active: true,
    tenantId: TENANT_HIMALAYAN,
    managedTenantIds: [],
    enabledFeatures: [...INVENTORY_FEATURES],
    canEdit: true,
    canDelete: false,
  },
  {
    id: "u5",
    name: "Bikash Thapa",
    email: "owner@pokharabeauty.example",
    password: DEMO_PASSWORD,
    role: "OWNER",
    avatar: "BT",
    status: "Active",
    active: true,
    tenantId: TENANT_POKHARA,
    managedTenantIds: [],
    enabledFeatures: null,
    canEdit: true,
    canDelete: true,
  },
  {
    id: "u6",
    name: "Anita KC",
    email: "anita@pokharabeauty.example",
    password: DEMO_PASSWORD,
    role: "SALES",
    avatar: "AK",
    status: "Active",
    active: true,
    tenantId: TENANT_POKHARA,
    managedTenantIds: [],
    enabledFeatures: ["dashboard", "sales", "galla", "orders", "customers", "notifications"],
    canEdit: true,
    canDelete: false,
  },
];
export const WALK_IN_CUSTOMER_ID = "walk-in";

export function getWalkInCustomer(tenantId: string): Customer {
  return {
    id: WALK_IN_CUSTOMER_ID,
    code: "CUS-000",
    name: "Walk-in / Cash Customer",
    type: "INDIVIDUAL",
    phone: "—",
    area: "Counter",
    creditLimit: 0,
    outstanding: 0,
    riskScore: 0,
    lastOrder: new Date().toISOString().slice(0, 10),
    orders: 0,
    lifetime: 0,
    tenantId,
  };
}

/** @deprecated Prefer getWalkInCustomer(activeTenantId) */
export const WALK_IN_CUSTOMER: Customer = getWalkInCustomer(TENANT_HIMALAYAN);

type AppState = {
  customers: Customer[];
  products: Product[];
  categories: ProductCategory[];
  suppliers: Supplier[];
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  expenses: Expense[];
  priceLists: PriceList[];
  priceListItems: PriceListItem[];
  specialPrices: CustomerSpecialPrice[];
  tenants: Tenant[];
  users: User[];
  branches: Branch[];
  currentUserId: string | null;
  /** Effective workspace for data isolation (client locked; admins can switch). */
  activeTenantId: string | null;
  addCustomer: (
    data: Omit<Customer, "id" | "code" | "outstanding" | "riskScore" | "lastOrder" | "orders" | "lifetime" | "tenantId"> &
      Partial<Pick<Customer, "outstanding" | "riskScore" | "tenantId" | "priceListId">>
  ) => Customer;
  updateCustomer: (
    customerId: string,
    data: Partial<Pick<Customer, "name" | "type" | "phone" | "area" | "creditLimit" | "priceListId">>
  ) => Customer | null;
  deleteCustomer: (customerId: string) => boolean;
  addCategory: (
    name: string,
    tenantId?: string
  ) => ProductCategory;
  addProduct: (
    data: Omit<Product, "id" | "stock" | "tenantId"> & Partial<Pick<Product, "stock" | "tenantId">>
  ) => Product;
  updateProduct: (
    productId: string,
    data: Partial<
      Pick<
        Product,
        | "name"
        | "sku"
        | "barcode"
        | "brand"
        | "category"
        | "size"
        | "unit"
        | "mrp"
        | "tradePrice"
        | "stock"
        | "reorderAt"
        | "vat"
        | "shade"
        | "batchNumber"
        | "expiresOn"
        | "paoMonths"
        | "isTester"
        | "image"
        | "galla"
      >
    >
  ) => Product | null;
  deleteProduct: (productId: string) => boolean;
  addSupplier: (
    data: Omit<Supplier, "id" | "outstanding" | "products" | "tenantId"> &
      Partial<Pick<Supplier, "outstanding" | "products" | "tenantId">>
  ) => Supplier;
  updateSupplier: (
    supplierId: string,
    data: Partial<Pick<Supplier, "name" | "contact" | "phone" | "pan" | "outstanding" | "products">>
  ) => Supplier | null;
  deleteSupplier: (supplierId: string) => boolean;
  addOrder: (
    data: Omit<Order, "id" | "number" | "date" | "status" | "invoiceId" | "invoiceNumber" | "tenantId"> &
      Partial<Pick<Order, "status" | "customerId" | "itemCount" | "tenantId">>
  ) => Order;
  updateOrder: (
    orderId: string,
    data: Partial<Pick<Order, "customer" | "customerId" | "status" | "items" | "itemCount" | "total">>
  ) => Order | null;
  deleteOrder: (orderId: string) => boolean;
  fulfillOrder: (
    orderId: string,
    data: FulfillOrderInput
  ) => { order: Order; invoice: Invoice } | null;
  addPurchaseOrder: (
    data: Omit<PurchaseOrder, "id" | "number" | "date" | "status" | "tenantId"> &
      Partial<Pick<PurchaseOrder, "status" | "tenantId">>
  ) => PurchaseOrder;
  updatePurchaseOrder: (
    poId: string,
    data: Partial<Pick<PurchaseOrder, "supplier" | "status" | "total" | "items">>
  ) => PurchaseOrder | null;
  deletePurchaseOrder: (poId: string) => boolean;
  addInvoice: (
    data: Omit<Invoice, "id" | "number" | "date" | "payments" | "tenantId"> &
      Partial<Pick<Invoice, "date" | "items" | "customerId" | "splitCash" | "splitQr" | "tenantId">>
  ) => Invoice;
  updateInvoice: (
    invoiceId: string,
    data: Partial<
      Pick<Invoice, "customer" | "customerId" | "status" | "method" | "subtotal" | "vat" | "total" | "due">
    >
  ) => Invoice | null;
  deleteInvoice: (invoiceId: string) => boolean;
  recordPayment: (invoiceId: string, amount: number, method: string, note?: string) => Invoice | null;
  deductStock: (lines: { productId: string; qty: number }[]) => void;
  addExpense: (
    data: Omit<Expense, "id" | "date" | "status" | "tenantId"> & Partial<Pick<Expense, "status" | "tenantId">>
  ) => Expense;
  updateExpense: (
    expenseId: string,
    data: Partial<Pick<Expense, "category" | "description" | "amount" | "status">>
  ) => Expense | null;
  deleteExpense: (expenseId: string) => boolean;
  addPriceList: (
    data: Omit<PriceList, "id" | "tenantId"> & Partial<Pick<PriceList, "tenantId" | "isDefault">>
  ) => PriceList;
  updatePriceList: (
    id: string,
    data: Partial<Pick<PriceList, "name" | "code" | "isDefault">>
  ) => PriceList | null;
  setDefaultPriceList: (id: string) => void;
  upsertPriceListItem: (
    data: Omit<PriceListItem, "id"> & { id?: string }
  ) => PriceListItem;
  /** Close prior open rates and insert new ones effective from a date (selected SKUs only). Syncs tradePrice when the list is default. */
  applyOvernightRates: (
    priceListId: string,
    rates: { productId: string; unitPrice: number }[],
    effectiveFrom: string
  ) => void;
  addSpecialPrice: (
    data: Omit<CustomerSpecialPrice, "id" | "tenantId"> & Partial<Pick<CustomerSpecialPrice, "tenantId" | "effectiveTo">>
  ) => CustomerSpecialPrice;
  updateSpecialPrice: (
    id: string,
    data: Partial<Pick<CustomerSpecialPrice, "unitPrice" | "effectiveFrom" | "effectiveTo" | "productId">>
  ) => CustomerSpecialPrice | null;
  removeSpecialPrice: (id: string) => void;
  addUser: (
    data: Omit<
      User,
      | "id"
      | "avatar"
      | "status"
      | "active"
      | "tenantId"
      | "enabledFeatures"
      | "managedTenantIds"
      | "canEdit"
      | "canDelete"
    > &
      Partial<
        Pick<
          User,
          | "tenantId"
          | "enabledFeatures"
          | "avatar"
          | "status"
          | "active"
          | "managedTenantIds"
          | "canEdit"
          | "canDelete"
        >
      >
  ) => User;
  updateUser: (
    userId: string,
    data: Partial<
      Pick<
        User,
        | "name"
        | "email"
        | "role"
        | "tenantId"
        | "enabledFeatures"
        | "status"
        | "active"
        | "managedTenantIds"
        | "canEdit"
        | "canDelete"
      >
    >
  ) => User | null;
  setUserPassword: (userId: string, password: string) => User | null;
  deactivateUser: (userId: string) => User | null;
  authenticate: (email: string, password: string) => User | null;
  setCurrentUserId: (userId: string | null) => void;
  setActiveTenantId: (tenantId: string | null) => boolean;
  addBranch: (data: Omit<Branch, "active" | "tenantId"> & Partial<Pick<Branch, "active" | "tenantId">>) => Branch;
  addTenant: (
    data: Pick<Tenant, "name"> &
      Partial<Pick<Tenant, "shortName" | "enabledFeatures" | "vatEnabled">>
  ) => Tenant;
  updateTenant: (
    tenantId: string,
    data: Partial<Pick<Tenant, "name" | "shortName" | "enabledFeatures" | "vatEnabled">>
  ) => Tenant | null;
  /** Soft-delete client (`active: false`) and deactivate that tenant's users. */
  deleteTenant: (tenantId: string) => Tenant | null;
  setTenantFeatures: (tenantId: string, features: FeatureKey[]) => void;
  toggleTenantFeature: (tenantId: string, feature: FeatureKey, enabled: boolean) => void;
  setUserFeatures: (userId: string, features: FeatureKey[] | null) => void;
  toggleUserFeature: (userId: string, feature: FeatureKey, enabled: boolean) => void;
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextCode(
  items: { code?: string; number?: string; tenantId?: string }[],
  prefix: string,
  field: "code" | "number" = "code",
  tenantId?: string | null
) {
  const scoped = tenantId ? items.filter((i) => i.tenantId === tenantId) : items;
  const nums = scoped
    .map((i) => {
      const raw = (field === "code" ? i.code : i.number) ?? "";
      const m = raw.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function findCustomerId(customers: Customer[], name: string, customerId?: string) {
  if (customerId) return customerId;
  return customers.find((c) => c.name === name)?.id;
}

function requireActiveTenant(get: () => AppState): string {
  const tid = get().activeTenantId;
  if (!tid) throw new Error("No active client workspace selected");
  return tid;
}

/** Ensure record belongs to the active client workspace (cross-tenant guard). */
function belongsToActiveTenant(tenantId: string | undefined, get: () => AppState): boolean {
  const active = get().activeTenantId;
  if (!active) return true;
  return !tenantId || tenantId === active;
}

function resolveLoginTenant(user: User, tenants: Tenant[]): string | null {
  const activeTenants = tenants.filter((t) => t.active !== false);
  if (user.tenantId) {
    const own = activeTenants.find((t) => t.id === user.tenantId);
    return own?.id ?? null;
  }
  if (user.role === "PLATFORM_ADMIN") {
    return activeTenants[0]?.id ?? TENANT_HIMALAYAN;
  }
  return null;
}

export function canUserAccessTenant(user: User | null | undefined, tenantId: string): boolean {
  if (!user) return false;
  if (user.role === "PLATFORM_ADMIN") return true;
  return user.tenantId === tenantId;
}

/** @deprecated Agency admins removed — prefer isSuperAdmin. */
export function isAgencyAdmin(user: User | null | undefined): boolean {
  return !!user && user.role === "ADMIN" && !user.tenantId;
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  return !!user && user.role === "PLATFORM_ADMIN";
}

/** Glamo store admin (owner/admin) — not multi-tenant platform admin. */
export function canAccessAdminPanel(user: User | null | undefined): boolean {
  if (!user || user.active === false) return false;
  return user.role === "OWNER" || user.role === "ADMIN";
}

export function canOnboardClients(_user: User | null | undefined): boolean {
  void _user;
  return false;
}

/** Client OWNER or tenant-scoped ADMIN can manage users for their company. */
export function canManageTenantUsers(user: User | null | undefined): boolean {
  if (!user || user.active === false) return false;
  if (!user.tenantId) return false;
  return user.role === "OWNER" || user.role === "ADMIN";
}

export function getManagedTenants(user: User | null | undefined, tenants: Tenant[]): Tenant[] {
  if (!user) return [];
  const active = tenants.filter((t) => t.active !== false);
  if (isSuperAdmin(user)) return active;
  if (user.tenantId) {
    return active.filter((t) => t.id === user.tenantId);
  }
  return [];
}

export function calcLineTotal(qty: number, unitPrice: number, discountPercent = 0) {
  const disc = Math.min(100, Math.max(0, discountPercent));
  return Math.round(qty * unitPrice * (1 - disc / 100));
}

function isRateActiveOnDate(
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
  date: string
) {
  if (date < effectiveFrom) return false;
  if (effectiveTo != null && effectiveTo !== "" && date > effectiveTo) return false;
  return true;
}

function pickLatestRate<T extends { effectiveFrom: string; unitPrice: number }>(
  rows: T[]
): T | undefined {
  if (!rows.length) return undefined;
  return [...rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve unit price for a product/customer on a given invoice date.
 * Order: customer special → customer price list → tenant default list → product.tradePrice.
 * Snapshot prices on invoice lines — never rewrite history when rates change overnight.
 */
export function resolveUnitPrice({
  productId,
  customerId,
  date,
}: {
  productId: string;
  customerId?: string | null;
  date?: string;
}): number {
  const state = useAppStore.getState();
  const product = state.products.find((p) => p.id === productId);
  if (!product) return 0;

  const onDate = date ?? today();
  const customer =
    customerId && customerId !== WALK_IN_CUSTOMER_ID
      ? state.customers.find((c) => c.id === customerId)
      : undefined;
  const tenantId = customer?.tenantId ?? product.tenantId ?? state.activeTenantId ?? undefined;

  if (customer) {
    const specials = state.specialPrices.filter(
      (s) =>
        s.customerId === customer.id &&
        s.productId === productId &&
        (!s.tenantId || !tenantId || s.tenantId === tenantId) &&
        isRateActiveOnDate(s.effectiveFrom, s.effectiveTo, onDate)
    );
    const special = pickLatestRate(specials);
    if (special) return special.unitPrice;
  }

  if (customer?.priceListId) {
    const items = state.priceListItems.filter(
      (i) =>
        i.priceListId === customer.priceListId &&
        i.productId === productId &&
        isRateActiveOnDate(i.effectiveFrom, i.effectiveTo, onDate)
    );
    const item = pickLatestRate(items);
    if (item) return item.unitPrice;
  }

  if (tenantId) {
    const defaultList = state.priceLists.find((l) => l.tenantId === tenantId && l.isDefault);
    if (defaultList) {
      const items = state.priceListItems.filter(
        (i) =>
          i.priceListId === defaultList.id &&
          i.productId === productId &&
          isRateActiveOnDate(i.effectiveFrom, i.effectiveTo, onDate)
      );
      const item = pickLatestRate(items);
      if (item) return item.unitPrice;
    }
  }

  return product.tradePrice;
}

const VAT_RATE = 0.13;

function calcInvoiceVat(subtotal: number, vatEnabled = true) {
  if (!vatEnabled) return { subtotal, vat: 0, total: subtotal };
  const vat = Math.round(subtotal * VAT_RATE);
  return { subtotal, vat, total: subtotal + vat };
}

/** Whether the given tenant (or active workspace) has VAT charging enabled. */
export function isTenantVatEnabled(
  tenants: Tenant[],
  tenantId: string | null | undefined
): boolean {
  if (!tenantId) return true;
  const tenant = tenants.find((t) => t.id === tenantId);
  return tenant?.vatEnabled !== false;
}

export function orderItemQty(order: Order): number {
  if (order.items?.length) return order.items.reduce((s, i) => s + i.qty, 0);
  return order.itemCount ?? 0;
}

export function isOrderFulfillable(order: Order): boolean {
  if (order.invoiceId) return false;
  return order.status !== "FULFILLED" && order.status !== "INVOICED";
}

function normalizeOrder(seed: (typeof ORDERS)[number]): Order {
  const count = typeof seed.items === "number" ? seed.items : 0;
  return {
    ...seed,
    items: [],
    itemCount: count,
  };
}

function byTenant<T extends { tenantId: string }>(items: T[], tenantId: string | null): T[] {
  if (!tenantId) return [];
  return items.filter((i) => i.tenantId === tenantId);
}

function categoriesFromProducts(
  products: { category?: string; tenantId: string }[],
  existing: ProductCategory[] = []
): ProductCategory[] {
  const seen = new Map<string, ProductCategory>();
  for (const c of existing) {
    const key = `${c.tenantId}::${c.name.trim().toLowerCase()}`;
    if (c.name.trim()) seen.set(key, c);
  }
  let n = existing.length + 1;
  for (const p of products) {
    const name = p.category?.trim();
    if (!name) continue;
    const key = `${p.tenantId}::${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.set(key, { id: `cat${n++}`, name, tenantId: p.tenantId });
  }
  return Array.from(seen.values());
}

function findTenantCategory(
  categories: ProductCategory[],
  tenantId: string,
  name: string
): ProductCategory | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return categories.find(
    (c) => c.tenantId === tenantId && c.name.trim().toLowerCase() === needle
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      customers: CUSTOMERS,
      products: PRODUCTS,
      categories: SEED_CATEGORIES,
      suppliers: SUPPLIERS,
      orders: ORDERS.map(normalizeOrder),
      purchaseOrders: PURCHASE_ORDERS,
      invoices: INVOICES.map((inv) => ({ ...inv, items: [], payments: [] })),
      expenses: EXPENSES,
      priceLists: PRICE_LISTS.map((l) => ({ ...l })),
      priceListItems: PRICE_LIST_ITEMS.map((i) => ({ ...i })),
      specialPrices: CUSTOMER_SPECIAL_PRICES.map((s) => ({ ...s })),
      tenants: SEED_TENANTS,
      users: SEED_USERS,
      currentUserId: null,
      activeTenantId: null,
      branches: [
        { name: "Head Office — Teku", code: "HQ", pan: "601234567", active: true, tenantId: TENANT_HIMALAYAN },
        { name: "Baneshwor Store", code: "BNE", pan: "601234567", active: true, tenantId: TENANT_HIMALAYAN },
        { name: "Patan Stockroom", code: "PTN", pan: "601234567", active: false, tenantId: TENANT_HIMALAYAN },
        { name: "Pokhara Depot", code: "PKR", pan: "609876543", active: true, tenantId: TENANT_POKHARA },
      ],

      addCustomer: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const defaultList = get().priceLists.find((l) => l.tenantId === tenantId && l.isDefault);
        const customer: Customer = {
          id: uid("c"),
          code: nextCode(get().customers, "CUS-", "code", tenantId),
          name: data.name,
          type: data.type,
          phone: data.phone,
          area: data.area,
          creditLimit: data.creditLimit,
          outstanding: data.outstanding ?? 0,
          riskScore: data.riskScore ?? 20,
          lastOrder: today(),
          orders: 0,
          lifetime: 0,
          tenantId,
          priceListId: data.priceListId ?? defaultList?.id,
        };
        set((s) => ({ customers: [customer, ...s.customers] }));
        return customer;
      },

      updateCustomer: (customerId, data) => {
        const existing = get().customers.find((c) => c.id === customerId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return null;
        const updated: Customer = { ...existing, ...data };
        set((s) => ({
          customers: s.customers.map((c) => (c.id === customerId ? updated : c)),
        }));
        return updated;
      },

      deleteCustomer: (customerId) => {
        const existing = get().customers.find((c) => c.id === customerId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return false;
        if (existing.id === WALK_IN_CUSTOMER_ID) return false;
        set((s) => ({
          customers: s.customers.filter((c) => c.id !== customerId),
          specialPrices: s.specialPrices.filter((sp) => sp.customerId !== customerId),
        }));
        return true;
      },

      addCategory: (name, tenantIdArg) => {
        const tenantId = tenantIdArg ?? requireActiveTenant(get);
        const trimmed = name.trim();
        if (!trimmed) throw new Error("Category name is required");
        const existing = findTenantCategory(get().categories, tenantId, trimmed);
        if (existing) return existing;
        const category: ProductCategory = {
          id: uid("cat"),
          name: trimmed,
          tenantId,
        };
        set((s) => ({ categories: [...s.categories, category] }));
        return category;
      },

      addProduct: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        if (get().products.some((p) => p.tenantId === tenantId && p.sku.toUpperCase() === data.sku.trim().toUpperCase())) throw new Error("A product with this SKU already exists");
        const vatEnabled = isTenantVatEnabled(get().tenants, tenantId);
        const categoryName = data.category.trim();
        if (categoryName && !findTenantCategory(get().categories, tenantId, categoryName)) {
          get().addCategory(categoryName, tenantId);
        }
        const product: Product = {
          id: uid("p"),
          sku: data.sku.trim().toUpperCase(),
          barcode: data.barcode,
          name: data.name,
          brand: data.brand,
          category: categoryName || data.category,
          size: data.size || "",
          shade: data.shade?.trim() || "",
          batchNumber: data.batchNumber?.trim() || "",
          expiresOn: data.expiresOn || "",
          paoMonths: data.paoMonths || "",
          isTester: data.isTester ?? false,
          unit: data.unit,
          mrp: data.mrp,
          tradePrice: data.tradePrice,
          stock: data.stock ?? 0,
          reorderAt: data.reorderAt,
          vat: vatEnabled ? data.vat : 0,
          galla: data.galla ?? true,
          image: data.image || "",
          tenantId,
        };
        set((s) => ({ products: [product, ...s.products] }));
        return product;
      },

      updateProduct: (productId, data) => {
        const existing = get().products.find((p) => p.id === productId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return null;
        if (data.sku) {
          const sku = data.sku.trim().toUpperCase();
          const clash = get().products.find(
            (p) =>
              p.id !== productId &&
              p.tenantId === existing.tenantId &&
              p.sku.toUpperCase() === sku
          );
          if (clash) throw new Error("A product with this SKU already exists");
        }
        if (data.category?.trim()) {
          const cat = data.category.trim();
          if (!findTenantCategory(get().categories, existing.tenantId, cat)) {
            get().addCategory(cat, existing.tenantId);
          }
        }
        const vatEnabled = isTenantVatEnabled(get().tenants, existing.tenantId);
        const updated: Product = {
          ...existing,
          ...data,
          ...(data.sku ? { sku: data.sku.trim().toUpperCase() } : {}),
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.brand ? { brand: data.brand.trim() } : {}),
          ...(data.category ? { category: data.category.trim() } : {}),
          ...(!vatEnabled ? { vat: 0 } : {}),
        };
        set((s) => ({
          products: s.products.map((p) => (p.id === productId ? updated : p)),
        }));
        return updated;
      },

      deleteProduct: (productId) => {
        const existing = get().products.find((p) => p.id === productId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return false;
        set((s) => ({
          products: s.products.filter((p) => p.id !== productId),
          priceListItems: s.priceListItems.filter((i) => i.productId !== productId),
          specialPrices: s.specialPrices.filter((sp) => sp.productId !== productId),
        }));
        return true;
      },

      addSupplier: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const supplier: Supplier = {
          id: uid("s"),
          name: data.name,
          contact: data.contact,
          phone: data.phone,
          pan: data.pan ?? "",
          outstanding: data.outstanding ?? 0,
          products: data.products ?? 0,
          tenantId,
        };
        set((s) => ({ suppliers: [supplier, ...s.suppliers] }));
        return supplier;
      },

      updateSupplier: (supplierId, data) => {
        const existing = get().suppliers.find((s) => s.id === supplierId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return null;
        const updated: Supplier = {
          ...existing,
          ...data,
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.contact ? { contact: data.contact.trim() } : {}),
          ...(data.pan !== undefined ? { pan: data.pan.trim() } : {}),
        };
        set((s) => ({
          suppliers: s.suppliers.map((sup) => (sup.id === supplierId ? updated : sup)),
        }));
        return updated;
      },

      deleteSupplier: (supplierId) => {
        const existing = get().suppliers.find((s) => s.id === supplierId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return false;
        set((s) => ({ suppliers: s.suppliers.filter((sup) => sup.id !== supplierId) }));
        return true;
      },

      addOrder: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const lineItems = Array.isArray(data.items) ? data.items : [];
        const itemCount =
          data.itemCount ?? (lineItems.length ? lineItems.reduce((s, i) => s + i.qty, 0) : 0);
        const order: Order = {
          id: uid("o"),
          number: nextCode(get().orders, "SO-", "number", tenantId),
          customer: data.customer,
          customerId: data.customerId,
          date: today(),
          status: data.status ?? "CONFIRMED",
          items: lineItems,
          itemCount,
          total: data.total,
          tenantId,
        };
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

      updateOrder: (orderId, data) => {
        const existing = get().orders.find((o) => o.id === orderId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return null;
        if (existing.invoiceId && (data.items || data.total != null || data.customer)) {
          // Keep header edits limited once invoiced — status-only is fine
          if (data.items || data.total != null || data.customer || data.customerId) {
            throw new Error("Invoiced orders cannot change customer or lines");
          }
        }
        const lineItems = data.items ?? existing.items;
        const itemCount =
          data.itemCount ??
          (lineItems?.length ? lineItems.reduce((s, i) => s + i.qty, 0) : existing.itemCount);
        const updated: Order = {
          ...existing,
          ...data,
          items: lineItems,
          itemCount,
        };
        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? updated : o)),
        }));
        return updated;
      },

      deleteOrder: (orderId) => {
        const existing = get().orders.find((o) => o.id === orderId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return false;
        if (existing.invoiceId) {
          throw new Error("Cannot delete an order that has been invoiced");
        }
        set((s) => ({ orders: s.orders.filter((o) => o.id !== orderId) }));
        return true;
      },

      fulfillOrder: (orderId, data) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || !isOrderFulfillable(order)) return null;
        if (!data.items.length) return null;
        if (get().activeTenantId && order.tenantId !== get().activeTenantId) return null;

        const subtotal = data.items.reduce((s, i) => s + i.lineTotal, 0);
        const vatEnabled = isTenantVatEnabled(get().tenants, order.tenantId);
        const { vat, total } = calcInvoiceVat(subtotal, vatEnabled);
        const isUnpaid = (data.paymentStatus ?? "UNPAID") === "UNPAID";
        const method = data.method ?? (isUnpaid ? "CREDIT" : "CASH");
        const tenantCustomers = byTenant(get().customers, order.tenantId);
        const customerId =
          order.customerId ?? findCustomerId(tenantCustomers, order.customer);

        const invoice = get().addInvoice({
          customer: order.customer,
          customerId,
          status: isUnpaid ? "ISSUED" : "PAID",
          method,
          subtotal,
          vat,
          total,
          due: isUnpaid ? total : 0,
          items: data.items,
          tenantId: order.tenantId,
          splitCash: method === "SPLIT" && !isUnpaid ? data.splitCash : undefined,
          splitQr: method === "SPLIT" && !isUnpaid ? data.splitQr : undefined,
        });

        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  items: data.items,
                  itemCount: data.items.reduce((sum, i) => sum + i.qty, 0),
                  total: subtotal,
                  status: "INVOICED",
                  customerId,
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.number,
                }
              : o
          ),
        }));

        const updated = get().orders.find((o) => o.id === orderId);
        if (!updated) return null;
        return { order: updated, invoice };
      },

      addPurchaseOrder: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const items = Array.isArray(data.items) ? data.items : undefined;
        const po: PurchaseOrder = {
          id: uid("po"),
          number: nextCode(get().purchaseOrders, "PO-", "number", tenantId),
          supplier: data.supplier,
          date: today(),
          status: data.status ?? "DRAFT",
          total: data.total,
          ...(items?.length ? { items } : {}),
          tenantId,
        };
        set((s) => ({ purchaseOrders: [po, ...s.purchaseOrders] }));
        return po;
      },

      updatePurchaseOrder: (poId, data) => {
        const existing = get().purchaseOrders.find((p) => p.id === poId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return null;
        const updated: PurchaseOrder = {
          ...existing,
          ...data,
          ...(data.supplier ? { supplier: data.supplier.trim() } : {}),
          ...(data.items !== undefined
            ? { items: data.items.length ? data.items : undefined }
            : {}),
        };
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) => (p.id === poId ? updated : p)),
        }));
        return updated;
      },

      deletePurchaseOrder: (poId) => {
        const existing = get().purchaseOrders.find((p) => p.id === poId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return false;
        set((s) => ({ purchaseOrders: s.purchaseOrders.filter((p) => p.id !== poId) }));
        return true;
      },

      addInvoice: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        if (!belongsToActiveTenant(tenantId, get)) throw new Error("Select the correct store before creating this sale");
        const quantities = new Map<string, number>();
        for (const line of data.items ?? []) {
          if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error("Sale quantities must be positive whole numbers");
          quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.qty);
        }
        for (const [id, qty] of quantities) {
          const product = get().products.find((p) => p.id === id && p.tenantId === tenantId);
          if (!product) throw new Error("Product is not available in this store");
          const blocked = saleBlockReason(product);
          if (blocked) throw new Error(blocked);
          if (qty > product.stock) throw new Error("Insufficient stock for " + product.name);
        }
        const tenantCustomers = byTenant(get().customers, tenantId);
        const customerId = findCustomerId(tenantCustomers, data.customer, data.customerId);
        const vatEnabled = isTenantVatEnabled(get().tenants, tenantId);
        const totals = vatEnabled
          ? { subtotal: data.subtotal, vat: data.vat, total: data.total }
          : { subtotal: data.subtotal, vat: 0, total: data.subtotal };
        const due = data.due ?? 0;
        const dueAmount = vatEnabled ? due : Math.min(due, totals.total);
        const invoice: Invoice = {
          id: uid("inv"),
          number: nextCode(get().invoices, "INV-", "number", tenantId),
          customer: data.customer,
          customerId,
          date: data.date ?? today(),
          status: data.status,
          method: data.method,
          subtotal: totals.subtotal,
          vat: totals.vat,
          total: totals.total,
          due: dueAmount,
          items: data.items ?? [],
          payments: [],
          splitCash: data.splitCash,
          splitQr: data.splitQr,
          tenantId,
        };

        set((s) => ({
          invoices: [invoice, ...s.invoices],
          customers: s.customers.map((c) => {
            if (c.id !== customerId || c.tenantId !== tenantId) return c;
            return {
              ...c,
              outstanding: c.outstanding + dueAmount,
              lastOrder: today(),
              orders: c.orders + 1,
              lifetime: c.lifetime + totals.total,
            };
          }),
        }));

        if (data.items?.length) {
          get().deductStock(data.items.map((i) => ({ productId: i.productId, qty: i.qty })));
          const mirrorItems = data.items
            .map((i) => {
              const product = get().products.find((p) => p.id === i.productId);
              return product ? { sku: product.sku, qty: i.qty } : null;
            })
            .filter((x): x is { sku: string; qty: number } => !!x);
          const paymentStatus =
            data.status === "PAID" ? "paid" : data.status === "PARTIALLY_PAID" ? "partial" : "unpaid";
          void mirrorStoreOrderToApi({
            customerName: data.customer,
            paymentStatus,
            items: mirrorItems,
          });
        }
        return invoice;
      },

      updateInvoice: (invoiceId, data) => {
        const existing = get().invoices.find((i) => i.id === invoiceId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return null;
        const prevDue = existing.due;
        const nextDue = data.due ?? existing.due;
        const dueDelta = nextDue - prevDue;
        const tenantCustomers = byTenant(get().customers, existing.tenantId);
        const customerId = findCustomerId(
          tenantCustomers,
          data.customer ?? existing.customer,
          data.customerId ?? existing.customerId
        );
        const updated: Invoice = { ...existing, ...data, customerId };
        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === invoiceId ? updated : i)),
          customers:
            dueDelta === 0
              ? s.customers
              : s.customers.map((c) =>
                  c.id === customerId && c.tenantId === existing.tenantId
                    ? { ...c, outstanding: Math.max(0, c.outstanding + dueDelta) }
                    : c
                ),
        }));
        return get().invoices.find((i) => i.id === invoiceId) ?? null;
      },

      deleteInvoice: (invoiceId) => {
        const existing = get().invoices.find((i) => i.id === invoiceId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return false;
        const tenantCustomers = byTenant(get().customers, existing.tenantId);
        const customerId = findCustomerId(tenantCustomers, existing.customer, existing.customerId);
        const due = existing.due;
        set((s) => ({
          invoices: s.invoices.filter((i) => i.id !== invoiceId),
          customers:
            due > 0
              ? s.customers.map((c) =>
                  c.id === customerId && c.tenantId === existing.tenantId
                    ? { ...c, outstanding: Math.max(0, c.outstanding - due) }
                    : c
                )
              : s.customers,
          // Unlink orders that pointed at this invoice
          orders: s.orders.map((o) =>
            o.invoiceId === invoiceId
              ? {
                  ...o,
                  invoiceId: undefined,
                  invoiceNumber: undefined,
                  status: "CONFIRMED",
                }
              : o
          ),
        }));
        // Restore stock from invoice lines if present
        if (existing.items?.length) {
          set((s) => ({
            products: s.products.map((p) => {
              if (p.tenantId !== existing.tenantId) return p;
              const matched = existing.items!.filter((i) => i.productId === p.id);
              if (!matched.length) return p;
              const qty = matched.reduce((sum, i) => sum + i.qty, 0);
              return { ...p, stock: p.stock + qty };
            }),
          }));
        }
        return true;
      },

      recordPayment: (invoiceId, amount, method, note) => {
        const inv = get().invoices.find((i) => i.id === invoiceId);
        if (!inv || amount <= 0) return null;
        if (get().activeTenantId && inv.tenantId !== get().activeTenantId) return null;
        const payAmount = Math.min(amount, inv.due);
        if (payAmount <= 0) return null;

        const newDue = Math.round(inv.due - payAmount);
        const status =
          newDue <= 0 ? "PAID" : payAmount > 0 && newDue < inv.total ? "PARTIALLY_PAID" : inv.status;

        const payment: InvoicePayment = {
          id: uid("pay"),
          amount: payAmount,
          method,
          date: today(),
          note,
        };

        const tenantCustomers = byTenant(get().customers, inv.tenantId);
        const customerId = findCustomerId(tenantCustomers, inv.customer, inv.customerId);

        set((s) => ({
          invoices: s.invoices.map((i) =>
            i.id === invoiceId
              ? {
                  ...i,
                  due: newDue,
                  status,
                  payments: [...(i.payments ?? []), payment],
                }
              : i
          ),
          customers: s.customers.map((c) =>
            c.id === customerId && c.tenantId === inv.tenantId
              ? { ...c, outstanding: Math.max(0, c.outstanding - payAmount) }
              : c
          ),
        }));

        return get().invoices.find((i) => i.id === invoiceId) ?? null;
      },

      deductStock: (lines) => {
        const tenantId = get().activeTenantId;
        set((s) => ({
          products: s.products.map((p) => {
            if (tenantId && p.tenantId !== tenantId) return p;
            const matched = lines.filter((l) => l.productId === p.id);
            if (!matched.length) return p;
            const qty = matched.reduce((sum, l) => sum + l.qty, 0);
            return { ...p, stock: Math.max(0, p.stock - qty) };
          }),
        }));
      },

      addExpense: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const expense: Expense = {
          id: uid("e"),
          category: data.category,
          description: data.description,
          amount: data.amount,
          date: today(),
          status: data.status ?? "DRAFT",
          tenantId,
        };
        set((s) => ({ expenses: [expense, ...s.expenses] }));
        return expense;
      },

      updateExpense: (expenseId, data) => {
        const existing = get().expenses.find((e) => e.id === expenseId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return null;
        const updated: Expense = {
          ...existing,
          ...data,
          ...(data.description ? { description: data.description.trim() } : {}),
        };
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === expenseId ? updated : e)),
        }));
        return updated;
      },

      deleteExpense: (expenseId) => {
        const existing = get().expenses.find((e) => e.id === expenseId);
        if (!existing || !belongsToActiveTenant(existing.tenantId, get)) return false;
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== expenseId) }));
        return true;
      },

      addPriceList: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const makeDefault = data.isDefault ?? get().priceLists.every((l) => l.tenantId !== tenantId);
        const list: PriceList = {
          id: uid("pl"),
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          isDefault: makeDefault,
          tenantId,
        };
        set((s) => ({
          priceLists: makeDefault
            ? [
                list,
                ...s.priceLists.map((l) =>
                  l.tenantId === tenantId ? { ...l, isDefault: false } : l
                ),
              ]
            : [list, ...s.priceLists],
        }));
        return list;
      },

      updatePriceList: (id, data) => {
        const existing = get().priceLists.find((l) => l.id === id);
        if (!existing) return null;
        if (get().activeTenantId && existing.tenantId !== get().activeTenantId) return null;
        const updated: PriceList = {
          ...existing,
          ...data,
          code: data.code != null ? data.code.trim().toUpperCase() : existing.code,
          name: data.name != null ? data.name.trim() : existing.name,
        };
        set((s) => ({
          priceLists: s.priceLists.map((l) => (l.id === id ? updated : l)),
        }));
        if (data.isDefault) get().setDefaultPriceList(id);
        return updated;
      },

      setDefaultPriceList: (id) => {
        const list = get().priceLists.find((l) => l.id === id);
        if (!list?.tenantId) return;
        const tenantId = list.tenantId;
        set((s) => ({
          priceLists: s.priceLists.map((l) =>
            l.tenantId === tenantId ? { ...l, isDefault: l.id === id } : l
          ),
        }));
      },

      upsertPriceListItem: (data) => {
        if (data.id) {
          const existing = get().priceListItems.find((i) => i.id === data.id);
          if (existing) {
            const updated: PriceListItem = {
              ...existing,
              priceListId: data.priceListId,
              productId: data.productId,
              unitPrice: data.unitPrice,
              effectiveFrom: data.effectiveFrom,
              effectiveTo: data.effectiveTo ?? null,
            };
            set((s) => ({
              priceListItems: s.priceListItems.map((i) => (i.id === data.id ? updated : i)),
            }));
            return updated;
          }
        }
        const item: PriceListItem = {
          id: uid("pli"),
          priceListId: data.priceListId,
          productId: data.productId,
          unitPrice: data.unitPrice,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo ?? null,
        };
        set((s) => ({ priceListItems: [item, ...s.priceListItems] }));
        return item;
      },

      applyOvernightRates: (priceListId, rates, effectiveFrom) => {
        const list = get().priceLists.find((l) => l.id === priceListId);
        if (!list) return;
        const activeTenantId = get().activeTenantId;
        if (activeTenantId && list.tenantId && list.tenantId !== activeTenantId) return;
        if (!rates.length) return;
        const priorEnd = dayBefore(effectiveFrom);
        const productIds = new Set(rates.map((r) => r.productId));
        set((s) => {
          const closed = s.priceListItems.map((item) => {
            if (item.priceListId !== priceListId) return item;
            if (!productIds.has(item.productId)) return item;
            if (item.effectiveTo != null && item.effectiveTo !== "") return item;
            if (item.effectiveFrom >= effectiveFrom) return item;
            return { ...item, effectiveTo: priorEnd };
          });
          const additions: PriceListItem[] = rates.map((r) => ({
            id: uid("pli"),
            priceListId,
            productId: r.productId,
            unitPrice: r.unitPrice,
            effectiveFrom,
            effectiveTo: null,
          }));
          // Sync catalog tradePrice when updating the tenant default list (inventory value / fallback).
          if (!list.isDefault) {
            return { priceListItems: [...additions, ...closed] };
          }
          const rateByProduct = new Map(rates.map((r) => [r.productId, r.unitPrice]));
          const products = s.products.map((p) => {
            const unitPrice = rateByProduct.get(p.id);
            return unitPrice != null ? { ...p, tradePrice: unitPrice } : p;
          });
          return { priceListItems: [...additions, ...closed], products };
        });
      },

      addSpecialPrice: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const special: CustomerSpecialPrice = {
          id: uid("csp"),
          tenantId,
          customerId: data.customerId,
          productId: data.productId,
          unitPrice: data.unitPrice,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo ?? null,
        };
        set((s) => ({ specialPrices: [special, ...s.specialPrices] }));
        return special;
      },

      updateSpecialPrice: (id, data) => {
        const existing = get().specialPrices.find((s) => s.id === id);
        if (!existing) return null;
        if (get().activeTenantId && existing.tenantId && existing.tenantId !== get().activeTenantId) {
          return null;
        }
        const updated: CustomerSpecialPrice = { ...existing, ...data };
        set((s) => ({
          specialPrices: s.specialPrices.map((sp) => (sp.id === id ? updated : sp)),
        }));
        return updated;
      },

      removeSpecialPrice: (id) => {
        set((s) => ({ specialPrices: s.specialPrices.filter((sp) => sp.id !== id) }));
      },

      addUser: (data) => {
        const initials =
          data.avatar ||
          data.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
        const email = data.email.trim().toLowerCase();
        const existing = get().users.find((u) => u.email === email);
        if (existing) {
          throw new Error("A user with this email already exists");
        }
        const role = data.role;
        if (role === "PLATFORM_ADMIN") {
          const hasSuper = get().users.some(
            (u) => u.role === "PLATFORM_ADMIN" && u.active !== false
          );
          if (hasSuper) {
            throw new Error("Only one Super admin is allowed");
          }
        }
        if (role === "ADMIN" && (data.tenantId == null || data.tenantId === "")) {
          throw new Error("Company admins must be assigned to a client");
        }
        const active = data.active ?? true;
        const isSuper = role === "PLATFORM_ADMIN";
        const isPrivileged = isSuper || role === "OWNER" || role === "ADMIN";
        const user: User = {
          id: uid("u"),
          name: data.name.trim(),
          email,
          password: data.password,
          role,
          avatar: initials || "U",
          status: data.status ?? (active ? "Active" : "Inactive"),
          active,
          tenantId: isSuper ? null : (data.tenantId ?? requireActiveTenant(get)),
          managedTenantIds: [],
          enabledFeatures: data.enabledFeatures ?? null,
          canEdit: data.canEdit ?? true,
          canDelete: data.canDelete ?? isPrivileged,
        };
        set((s) => ({ users: [...s.users, user] }));
        return user;
      },

      updateUser: (userId, data) => {
        const current = get().users.find((u) => u.id === userId);
        if (!current) return null;
        if (data.email) {
          const email = data.email.trim().toLowerCase();
          const clash = get().users.find((u) => u.id !== userId && u.email === email);
          if (clash) throw new Error("A user with this email already exists");
        }
        set((s) => ({
          users: s.users.map((u) => {
            if (u.id !== userId) return u;
            const next = { ...u, ...data };
            if (data.email) next.email = data.email.trim().toLowerCase();
            if (data.name) next.name = data.name.trim();
            if (typeof data.active === "boolean") {
              next.active = data.active;
              next.status = data.active ? "Active" : "Inactive";
            }
            return next;
          }),
        }));
        return get().users.find((u) => u.id === userId) ?? null;
      },

      setUserPassword: (userId, password) => {
        if (!password) return null;
        const current = get().users.find((u) => u.id === userId);
        if (!current) return null;
        set((s) => ({
          users: s.users.map((u) => (u.id === userId ? { ...u, password } : u)),
        }));
        return get().users.find((u) => u.id === userId) ?? null;
      },

      deactivateUser: (userId) => {
        return get().updateUser(userId, { active: false, status: "Inactive" });
      },

      authenticate: (email, password) => {
        const normalized = email.trim().toLowerCase();
        const user = get().users.find(
          (u) =>
            u.email === normalized &&
            u.password === password &&
            u.active !== false &&
            u.status !== "Inactive"
        );
        if (!user) return null;
        if (user.tenantId) {
          const tenant = get().tenants.find((t) => t.id === user.tenantId);
          if (!tenant || tenant.active === false) return null;
        }
        const activeTenantId = resolveLoginTenant(user, get().tenants);
        if (!activeTenantId && user.role !== "PLATFORM_ADMIN") return null;
        set({ currentUserId: user.id, activeTenantId });
        return user;
      },

      setCurrentUserId: (userId) => {
        if (!userId) {
          set({ currentUserId: null, activeTenantId: null });
          return;
        }
        const user = get().users.find((u) => u.id === userId);
        if (!user) {
          set({ currentUserId: null, activeTenantId: null });
          return;
        }
        set({
          currentUserId: userId,
          activeTenantId: resolveLoginTenant(user, get().tenants),
        });
      },

      setActiveTenantId: (tenantId) => {
        const user = get().users.find((u) => u.id === get().currentUserId);
        if (!user) return false;
        if (!tenantId) {
          if (user.tenantId) return false;
          set({ activeTenantId: null });
          return true;
        }
        const tenant = get().tenants.find((t) => t.id === tenantId);
        if (!tenant || tenant.active === false) return false;
        if (!canUserAccessTenant(user, tenantId)) return false;
        set({ activeTenantId: tenantId });
        return true;
      },

      addBranch: (data) => {
        const tenantId = data.tenantId ?? requireActiveTenant(get);
        const branch: Branch = {
          name: data.name,
          code: data.code.toUpperCase(),
          pan: data.pan,
          active: data.active ?? true,
          tenantId,
        };
        set((s) => ({ branches: [...s.branches, branch] }));
        return branch;
      },

      addTenant: (data) => {
        const name = data.name.trim();
        if (!name) throw new Error("Client name is required");
        const shortName = (data.shortName?.trim() || name).slice(0, 48);
        const clash = get().tenants.find(
          (t) =>
            t.active !== false &&
            (t.name.toLowerCase() === name.toLowerCase() ||
              t.shortName.toLowerCase() === shortName.toLowerCase())
        );
        if (clash) throw new Error("A client with this name already exists");
        const currentUserId = get().currentUserId;
        const currentUser = get().users.find((u) => u.id === currentUserId);
        if (!canOnboardClients(currentUser)) {
          throw new Error("You do not have permission to add clients");
        }
        const tenant: Tenant = {
          id: uid("t"),
          name,
          shortName,
          enabledFeatures: data.enabledFeatures ?? [...STARTER_TENANT_FEATURES],
          vatEnabled: data.vatEnabled ?? true,
          active: true,
          createdByUserId: currentUserId,
        };
        set((s) => ({
          tenants: [...s.tenants, tenant],
          activeTenantId: s.activeTenantId ?? tenant.id,
        }));
        return tenant;
      },

      updateTenant: (tenantId, data) => {
        const current = get().tenants.find((t) => t.id === tenantId);
        if (!current || current.active === false) return null;
        const name = data.name?.trim();
        const shortName = data.shortName?.trim();
        if (name !== undefined && !name) throw new Error("Client name is required");
        const nextName = name ?? current.name;
        const nextShort = (shortName ?? current.shortName).slice(0, 48);
        const clash = get().tenants.find(
          (t) =>
            t.id !== tenantId &&
            t.active !== false &&
            (t.name.toLowerCase() === nextName.toLowerCase() ||
              t.shortName.toLowerCase() === nextShort.toLowerCase())
        );
        if (clash) throw new Error("A client with this name already exists");
        const currentUser = get().users.find((u) => u.id === get().currentUserId);
        const canEdit =
          isSuperAdmin(currentUser) ||
          (canManageTenantUsers(currentUser) && currentUser?.tenantId === tenantId);
        if (!canEdit) {
          throw new Error("You do not have permission to update this client");
        }
        set((s) => ({
          tenants: s.tenants.map((t) => {
            if (t.id !== tenantId) return t;
            return {
              ...t,
              name: nextName,
              shortName: nextShort,
              ...(data.enabledFeatures ? { enabledFeatures: data.enabledFeatures } : {}),
              ...(data.vatEnabled !== undefined ? { vatEnabled: data.vatEnabled } : {}),
            };
          }),
        }));
        return get().tenants.find((t) => t.id === tenantId) ?? null;
      },

      deleteTenant: (tenantId) => {
        const current = get().tenants.find((t) => t.id === tenantId);
        if (!current || current.active === false) return null;
        const currentUser = get().users.find((u) => u.id === get().currentUserId);
        if (!isSuperAdmin(currentUser)) {
          throw new Error("Only Super admin can delete clients");
        }
        set((s) => {
          const nextActive =
            s.activeTenantId === tenantId
              ? s.tenants.find((t) => t.id !== tenantId && t.active !== false)?.id ?? null
              : s.activeTenantId;
          return {
            tenants: s.tenants.map((t) =>
              t.id === tenantId ? { ...t, active: false } : t
            ),
            users: s.users.map((u) =>
              u.tenantId === tenantId
                ? { ...u, active: false, status: "Inactive" }
                : u
            ),
            activeTenantId: nextActive,
          };
        });
        return get().tenants.find((t) => t.id === tenantId) ?? null;
      },

      setTenantFeatures: (tenantId, features) => {
        const normalized = normalizeFeatureList(features) ?? [];
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === tenantId ? { ...t, enabledFeatures: normalized } : t
          ),
        }));
      },

      toggleTenantFeature: (tenantId, feature, enabled) => {
        const mapped =
          (feature as string) === "finance" ? ("expenses" as FeatureKey) : feature;
        if (!(FULL_TENANT_FEATURES as readonly string[]).includes(mapped)) return;
        set((s) => ({
          tenants: s.tenants.map((t) => {
            if (t.id !== tenantId) return t;
            const next = new Set(normalizeFeatureList(t.enabledFeatures) ?? []);
            if (enabled) next.add(mapped);
            else next.delete(mapped);
            return { ...t, enabledFeatures: FULL_TENANT_FEATURES.filter((k) => next.has(k)) };
          }),
          users: s.users.map((u) => {
            if (u.tenantId !== tenantId || !u.enabledFeatures || enabled) return u;
            return {
              ...u,
              enabledFeatures: (normalizeFeatureList(u.enabledFeatures) ?? []).filter(
                (f) => f !== mapped
              ),
            };
          }),
        }));
      },

      setUserFeatures: (userId, features) => {
        set((s) => ({
          users: s.users.map((u) =>
            u.id === userId
              ? { ...u, enabledFeatures: normalizeFeatureList(features) }
              : u
          ),
        }));
      },

      toggleUserFeature: (userId, feature, enabled) => {
        set((s) => {
          const user = s.users.find((u) => u.id === userId);
          if (!user) return s;
          const tenant = s.tenants.find((t) => t.id === user.tenantId);
          const tenantFeatures = tenant?.enabledFeatures ?? [];
          const base =
            user.enabledFeatures ??
            (FULL_TENANT_FEATURES.filter((k) => tenantFeatures.includes(k)) as FeatureKey[]);
          const next = new Set(base);
          if (enabled) next.add(feature);
          else next.delete(feature);
          return {
            users: s.users.map((u) =>
              u.id === userId
                ? {
                    ...u,
                    enabledFeatures: FULL_TENANT_FEATURES.filter((k) => next.has(k)),
                  }
                : u
            ),
          };
        });
      },
    }),
    {
      name: "glamo-nepal-store-v1",
      version: 4,
      migrate: (persisted, fromVersion) => {
        const state = persisted as
          | {
              tenants?: Tenant[];
              products?: Product[];
              categories?: ProductCategory[];
              users?: User[];
            }
          | undefined;
        if (!state) return persisted as never;
        const withVat = state.tenants
          ? {
              ...state,
              tenants: state.tenants.map((t) => {
                const normalized =
                  normalizeFeatureList(t.enabledFeatures) ?? [...STARTER_TENANT_FEATURES];
                // Restore modules stripped by older builds
                const ensured = new Set(normalized);
                for (const key of [
                  "sales",
                  "galla",
                  "orders",
                  "analytics",
                  "settings",
                ] as FeatureKey[]) {
                  ensured.add(key);
                }
                return {
                  ...t,
                  name: t.id === TENANT_HIMALAYAN ? "Glamo Nepal" : t.name,
                  shortName: t.id === TENANT_HIMALAYAN ? "Glamo Nepal" : t.shortName,
                  vatEnabled:
                    fromVersion < 2 && t.id === TENANT_HIMALAYAN
                      ? false
                      : t.vatEnabled === true,
                  enabledFeatures: [...ensured],
                };
              }),
            }
          : state;
        const existing = withVat.products ?? [];
        const byId = new Map(existing.map((p) => [p.id, p]));
        for (const seed of PRODUCTS) {
          if (!byId.has(seed.id)) byId.set(seed.id, seed);
        }
        const withSeedGalla = Array.from(byId.values()).map((p) => {
          const raw = p as Product & { galla?: boolean; image?: string };
          const seed = PRODUCTS.find((s) => s.id === p.id);
          let galla = true;
          if (Object.prototype.hasOwnProperty.call(raw, "galla")) {
            galla = raw.galla !== false;
          } else if (seed) {
            galla = seed.galla;
          }
          return {
            ...p,
            galla,
            image: raw.image || "",
          };
        });
        const categories = categoriesFromProducts(withSeedGalla, withVat.categories ?? []);
        const users = (withVat.users ?? []).map((u) => {
          const privileged =
            u.role === "PLATFORM_ADMIN" || u.role === "OWNER" || u.role === "ADMIN";
          const email =
            u.email === "manager@himalayanbeauty.example" || u.id === "u7"
              ? "manager@glamonepal.com"
              : u.email;
          const name = u.id === "u7" ? "Glamo Manager" : u.name;
          return {
            ...u,
            email,
            name,
            avatar: u.id === "u7" ? "GN" : u.avatar,
            enabledFeatures: normalizeFeatureList(u.enabledFeatures),
            canEdit: (u as User & { canEdit?: boolean }).canEdit ?? true,
            canDelete: (u as User & { canDelete?: boolean }).canDelete ?? privileged,
          };
        });
        return migrateGlamoCatalog({
          ...withVat,
          products: withSeedGalla,
          categories,
          users,
        }) as never;
      },
    }
  )
);
