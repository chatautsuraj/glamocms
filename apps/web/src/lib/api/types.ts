/**
 * Types mirroring docs/POS-API-CONTRACT.md (v2) + the backend implementation
 * notes. All money is whole-rupee integer NPR.
 */

export type Role = "CUSTOMER" | "CASHIER" | "MANAGER" | "ADMIN" | "SUPER_ADMIN" | "OWNER" | "STAFF";

export type Permission =
  | "pos.sell"
  | "pos.till"
  | "pos.override"
  | "orders.read.own"
  | "orders.read.all"
  | "orders.write"
  | "customers.write"
  | "catalog.write"
  | "inventory.write"
  | "analytics.read"
  | "reports.read"
  | "delivery.manage"
  | "whatsapp.inbox"
  | "settings.read"
  | "settings.write"
  | "staff.manage"
  | "whatsapp.broadcast";

export type Channel = "WEBSITE" | "POS_COUNTER" | "WHATSAPP" | "PHONE" | "MANUAL";
export type SaleChannel = "POS_COUNTER" | "PHONE" | "MANUAL" | "WHATSAPP";
export const ORDER_CHANNELS: Channel[] = ["POS_COUNTER", "WEBSITE", "WHATSAPP", "PHONE", "MANUAL"];

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";
export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED",
];

export type PaymentMethod = "CASH" | "FONEPAY_QR" | "ESEWA" | "KHALTI" | "CARD" | "BANK_TRANSFER";
export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "FONEPAY_QR", "ESEWA", "KHALTI", "CARD", "BANK_TRANSFER"];

export interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: { page: number; limit: number; total: number; serverTime?: string };
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  duplicate?: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface StoreProfile {
  name: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  pan: string;
  vatNumber: string;
  logoUrl: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  photoUrl: string | null;
}

export interface PaymentSettings {
  cash: { enabled: boolean };
  fonepay: { enabled: boolean; merchantName: string; terminalId: string; qrImageUrl: string };
  esewa: { enabled: boolean; accountName: string; accountId: string; qrImageUrl: string };
  khalti: { enabled: boolean; accountName: string; accountId: string; qrImageUrl: string };
  card: { enabled: boolean };
  bank: { enabled: boolean; bankName: string; accountName: string; accountNumber: string; branch: string; qrImageUrl: string };
}

export type LabelSize = "38x25" | "50x25" | "A4-65";

export interface LabelSettings {
  size: LabelSize;
  showPrice: boolean;
  showName: boolean;
}

/** Non-secret selling config every POS user receives (session.posConfig = GET /pos/config). */
export interface PosConfig {
  vatEnabled: boolean;
  /** 0 when VAT is off. */
  vatRate: number;
  receiptFooter: string;
  billPrefix: string;
  maxCashierDiscountPct: number;
  allowNegativeStock: boolean;
  requireCustomerForCounter: boolean;
  /** vatEnabled && store.pan */
  taxInvoice: boolean;
  payments: PaymentSettings;
  labels: LabelSettings;
  store: StoreProfile;
}

export interface PosSession {
  user: SessionUser;
  permissions: Permission[];
  store: StoreProfile;
  posConfig?: PosConfig;
}

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  photoUrl: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PosVariant {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  /** Effective selling price. */
  price: number;
  basePrice?: number;
  salePrice?: number | null;
  stock: number;
  attributes?: Record<string, string>;
}

export interface PosImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface PosProductAttributes {
  shade?: string;
  batch?: string;
  expiry?: string;
  tester?: boolean;
}

export interface PosProduct {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  slug?: string;
  brand: string | null;
  brandId?: string | null;
  category: string | null;
  categoryId?: string | null;
  price: number;
  basePrice: number;
  salePrice: number | null;
  mrp: number | null;
  costPrice?: number | null;
  vatApplicable: boolean;
  posVisible: boolean;
  trackInventory?: boolean;
  stock: number;
  lowStockThreshold: number;
  /** Primary image (= images[0].url). */
  imageUrl: string | null;
  images?: PosImage[];
  isActive: boolean;
  attributes: PosProductAttributes;
  variants: PosVariant[];
  updatedAt: string | null;
  deleted?: boolean;
  matchedVariantId?: string | null;
  description?: string | null;
}

export interface PosProductWrite {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  categoryId: string;
  brandId?: string | null;
  basePrice: number;
  salePrice?: number | null;
  mrp?: number | null;
  costPrice?: number | null;
  vatApplicable?: boolean;
  posVisible?: boolean;
  isActive?: boolean;
  trackInventory?: boolean;
  stock?: number;
  lowStockThreshold?: number;
  attributes?: PosProductAttributes;
  images?: string[];
}

export type InventoryReason = "RECEIVE" | "ADJUST" | "DAMAGE" | "RETURN" | "COUNT";

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string | null;
  variantId: string | null;
  variantName: string | null;
  type: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  performedBy: string | null;
  performedByName: string | null;
  createdAt: string | null;
}

export interface VariantWrite {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number;
  salePrice?: number | null;
  attributes?: Record<string, string>;
}

/** Optional cash-drawer count (API: /pos/till/*). Selling never needs one. */
export interface DrawerShift {
  id: string;
  cashierId: string;
  cashierName: string;
  openingFloat: number;
  closingCash: number | null;
  expectedCash: number;
  cashSales: number;
  variance: number | null;
  status: "open" | "closed";
  notes: string | null;
  openedAt: string | null;
  closedAt: string | null;
  totals: { sales: number; orders: number; refunds: number; byMethod: Record<string, number> };
}

export interface SaleCustomerInput {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SaleItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice?: number;
  lineDiscount?: number;
}

export interface TenderInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface DeliveryInput {
  required: boolean;
  address: string;
  city: string;
  branch?: string;
  codAmount?: number;
  charge?: number;
}

export interface SalePayload {
  clientRef: string;
  shiftId?: string;
  channel?: SaleChannel;
  customer?: SaleCustomerInput;
  items: SaleItemInput[];
  discount?: number;
  notes?: string;
  delivery?: DeliveryInput;
  payments: TenderInput[];
  createdAt?: string;
}

export interface BillItem {
  name: string;
  sku: string | null;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  vatApplicable: boolean;
  lineTotal: number;
}

export interface BillData {
  printableRef: string;
  createdAt: string;
  cashierName: string;
  customer: { name: string; phone: string | null };
  items: BillItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  /** Global VAT switch at the time of the sale; false → no VAT lines on the bill. */
  vatEnabled: boolean;
  /** VAT on and store PAN set → "Tax invoice · PAN …". */
  taxInvoice: boolean;
  total: number;
  payments: Array<{ method: string; amount: number; reference: string | null }>;
  tendered: number;
  change: number;
  due: number;
  footer: string;
  store: StoreProfile;
  /** Client-only: channel shown on the bill. */
  channel?: string;
  /** Client-only: true when printed from an offline queued sale. */
  provisional?: boolean;
}

export interface PosOrderItem {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface PosOrderPayment {
  id: string;
  kind: "PAYMENT" | "REFUND";
  method: string;
  amount: number;
  tendered: number | null;
  reference: string | null;
  shiftId: string | null;
  createdAt: string | null;
}

export type ShipmentStatus =
  | "CREATING"
  | "ERROR"
  | "ORDER_CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "ARRIVED_AT_HUB"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RETURNED_TO_SENDER";

export interface Shipment {
  id: string;
  orderId: string;
  provider: "NCM";
  externalId: string | null;
  trackingCode: string | null;
  status: ShipmentStatus;
  lastStatus?: string | null;
  error?: string | null;
  timeline: Array<{ status: string; internalStatus?: string; at: string; location?: string | null }>;
  charge: number | null;
  codAmount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ShippingAddress {
  fullName?: string;
  phone?: string;
  email?: string;
  address1?: string;
  city?: string;
  district?: string;
  branch?: string | null;
  codAmount?: number;
  deliveryCharge?: number;
  pickup?: boolean;
  [key: string]: unknown;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  printableRef: string | null;
  channel: Channel;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string | null;
  customer: { id: string; name: string; phone: string | null; email: string | null; walkIn?: boolean };
  cashier: { id: string; name: string } | null;
  shiftId: string | null;
  items: PosOrderItem[];
  subtotal: number;
  discountAmount: number;
  shippingCharge: number;
  vatAmount: number;
  totalAmount: number;
  refundedAmount: number;
  payments: PosOrderPayment[];
  shipment: Shipment | null;
  shippingAddress: ShippingAddress;
  notes: string | null;
  cancelReason: string | null;
  timeline: Array<{ status: string; note: string | null; by: string | null; at: string | null }>;
  bill?: { order?: PosOrder; bill?: BillData } | BillData;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SaleResult {
  order: PosOrder;
  bill: BillData;
  duplicate: boolean;
}

export type SyncStatus = "created" | "duplicate" | "conflict" | "error";

export interface SyncResult {
  clientRef: string;
  status: SyncStatus;
  orderId?: string;
  printableRef?: string;
  reason?: string;
  conflicts?: Array<{ productId: string; variantId?: string | null; requested: number; available: number }>;
}

export interface SyncConflict {
  id: string;
  clientRef: string;
  orderId: string | null;
  printableRef: string | null;
  cashierId: string | null;
  productId: string;
  productName: string | null;
  variantId: string | null;
  variantName: string | null;
  requested: number;
  available: number;
  status: string;
  note: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  marketingConsent: boolean;
  createdAt: string | null;
  orders?: number;
}

export interface CustomerDetail extends Customer {
  stats: { orders: number; totalSpent: number; aov: number; lastOrderAt: string | null };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    printableRef: string | null;
    channel: Channel;
    status: OrderStatus;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string | null;
  }>;
}

export interface AnalyticsSummary {
  range?: { from: string; to: string };
  totals: {
    revenue: number;
    netRevenue?: number;
    orders: number;
    aov: number;
    items: number;
    grossMargin: number;
    refunds: number;
    vat: number;
    discounts: number;
  };
  byChannel: Array<{ channel: Channel; revenue: number; orders: number; aov: number; items: number }>;
  series: Array<{ date: string; channel: Channel; revenue: number; orders: number }>;
}

export type BreakdownGroup = "channel" | "product" | "staff" | "hour" | "payment" | "category";
export interface BreakdownRow {
  key: string;
  label: string;
  revenue: number;
  orders: number;
  items: number;
  margin: number | null;
}

export type ReportType = "sales" | "vat" | "inventory" | "till" | "products";
export interface ReportData {
  type: ReportType;
  range: { from: string; to: string };
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface PosSettings {
  store: StoreProfile;
  pos: {
    vatEnabled: boolean;
    vatRate: number;
    receiptFooter: string;
    allowNegativeStock: boolean;
    maxCashierDiscountPct: number;
    billPrefix: string;
    requireCustomerForCounter: boolean;
  };
  payments: PaymentSettings;
  labels: LabelSettings;
  delivery: { ncmEnabled: boolean; ncmPickupBranch: string; ncmEnv: "dev" | "prod"; defaultDeliveryType: string };
  whatsapp: { enabled: boolean; phoneNumberDisplay: string; autoReplyEnabled: boolean; aiReplyEnabled: boolean };
}

export type PosSettingsPatch = {
  store?: Partial<StoreProfile>;
  pos?: Partial<PosSettings["pos"]>;
  payments?: { [K in keyof PaymentSettings]?: Partial<PaymentSettings[K]> };
  labels?: Partial<LabelSettings>;
  delivery?: Partial<PosSettings["delivery"]>;
  whatsapp?: Partial<PosSettings["whatsapp"]>;
};

export interface NcmBranch {
  name: string;
  code: string;
  district: string;
  phone: string | null;
}

export interface NcmRate {
  creation: string;
  destination: string;
  type: string;
  charge: number;
}

export interface WaConversation {
  waId: string;
  phone: string;
  name: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  handoff: boolean;
  orderId?: string | null;
  userId?: string | null;
  state?: string;
  lastInboundAt?: string | null;
  windowOpen?: boolean;
}

export interface WaMessage {
  id: string;
  waMessageId: string | null;
  direction: "in" | "out";
  type: string;
  body: string | null;
  mediaUrl: string | null;
  orderId: string | null;
  handledBy: string | null;
  status: string | null;
  createdAt: string | null;
}

export interface WaConversationDetail {
  waId: string;
  phone: string;
  name: string | null;
  userId: string | null;
  state: string;
  handoff: boolean;
  windowOpen: boolean;
  lastInboundAt: string | null;
  messages: WaMessage[];
}

export interface BroadcastInput {
  templateName: string;
  language: string;
  audience: "consented" | "customerIds";
  customerIds?: string[];
  params?: string[];
  offset?: number;
}

export interface BroadcastResult {
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  offset: number;
  nextOffset: number | null;
  remaining: number;
  failures: Array<{ phone?: string; customerId?: string; error?: string }>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  productCount: number;
}
