/** Fixed sample data shared by the fixture generator and the parity test. */

export const OLD_COMPANY = {
  name: "Glamo Nepal",
  address: "S.S Chowk, Madhyapur Thimi, Bagmati Province 44800",
  phone: "981-8212188",
  email: "hello@glamonepal.com",
  pan: "601234567",
  vat: "601234567",
};

export const SAMPLE_PRINTED_AT = "2026-10-18T06:15:30.000Z";

export const SAMPLE_LINES = [
  { name: "Maybelline Fit Me Matte Foundation 128 Warm Nude", qty: 1, unitPrice: 1450, lineTotal: 1450 },
  { name: "Lakme Eyeconic Kajal", qty: 2, unitPrice: 325, lineTotal: 650 },
  { name: "Nivea Soft <Cream> & \"Co\"", qty: 3, unitPrice: 299, lineTotal: 797 },
];

export const SAMPLE_BILL_OPTS = {
  orderId: "GLM-261018-0042",
  customerName: "Sita Shrestha",
  customerPhone: "9800000001",
  method: "CASH + FONEPAY_QR",
  channel: "POS_COUNTER",
  lines: SAMPLE_LINES,
  subtotal: 2897,
  vat: 333,
  total: 2897,
  vatEnabled: true,
  printedAt: SAMPLE_PRINTED_AT,
};

export const SAMPLE_TAX_OPTS = { ...SAMPLE_BILL_OPTS, invoiceType: "tax" as const, buyerPan: "301234567" };

/** Old ApiOrder shape (commerce-client) for the delivery note. */
export const SAMPLE_OLD_DELIVERY_ORDER = {
  id: "GLM-261018-0043",
  channel: "PHONE",
  paymentStatus: "PENDING",
  amount: 2047,
  createdAt: "2026-10-18T06:15:30.000Z",
  deliveryScheduledAt: null,
  customer: { name: "Ram Thapa", phone: "9800000002" },
  deliveryAddress: "Lakeside-6, Pokhara",
  deliveryNotes: "Call before arriving",
  deliveryAssignee: null,
  items: [
    { id: "it1", qty: 1, unitPrice: 1450, lineTotal: 1450, product: { id: "p1", sku: "MAY-FITME-128", name: "Maybelline Fit Me Matte Foundation" } },
    { id: "it2", qty: 2, unitPrice: 299, lineTotal: 597, product: { id: "p2", sku: "NIV-SOFT-50", name: "Nivea Soft Cream" } },
  ],
};

/** Same company as the old mock-data COMPANY, in the new BillCompany shape. */
export const OLD_COMPANY_AS_BILL = { ...OLD_COMPANY, category: "Cosmetics store" };

/** The real GLAMO store profile (what /pos/settings returns in production). */
export const REAL_STORE = {
  name: "GLAMO Nepal",
  legalName: "GLAMO Nepal Pvt. Ltd.",
  address: "S.S Chowk, Madhyapur Thimi, Bagmati",
  phone: "+977 9818212188",
  email: "hello@glamonepal.com",
  pan: "609876543",
  vatNumber: "609876543",
  logoUrl: "https://glamonepal.com/images/logo.png",
};

/** Server BillData equivalent of SAMPLE_BILL_OPTS. */
export const SAMPLE_BILL_DATA = {
  printableRef: "GLM-261018-0042",
  createdAt: SAMPLE_PRINTED_AT,
  cashierName: "Asha",
  customer: { name: "Sita Shrestha", phone: "9800000001" },
  items: SAMPLE_LINES.map((l) => ({ name: l.name, sku: null, qty: l.qty, unitPrice: l.unitPrice, lineDiscount: l.unitPrice * l.qty - l.lineTotal, vatApplicable: true, lineTotal: l.lineTotal })),
  subtotal: 2897,
  discount: 0,
  deliveryCharge: 0,
  taxableAmount: 2564,
  vatRate: 13,
  vatAmount: 333,
  total: 2897,
  payments: [
    { method: "CASH", amount: 1000, reference: null },
    { method: "FONEPAY_QR", amount: 1897, reference: "FP123" },
  ],
  tendered: 2897,
  change: 0,
  due: 0,
  footer: "Thank you",
  store: REAL_STORE,
  channel: "POS_COUNTER",
};

/** New PosOrder equivalent of SAMPLE_OLD_DELIVERY_ORDER. */
export const SAMPLE_POS_ORDER = {
  id: "ord_1",
  orderNumber: "ORD-1001",
  printableRef: "GLM-261018-0043",
  channel: "PHONE",
  status: "PACKED",
  paymentStatus: "PENDING",
  paymentMethod: "CASH_ON_DELIVERY",
  customer: { id: "c1", name: "Ram Thapa", phone: "9800000002", email: null },
  cashier: { id: "u1", name: "Asha" },
  shiftId: null,
  items: [
    { id: "it1", productId: "p1", variantId: null, name: "Maybelline Fit Me Matte Foundation", variantName: null, sku: "MAY-FITME-128", quantity: 1, unitPrice: 1450, lineDiscount: 0, lineTotal: 1450, imageUrl: null },
    { id: "it2", productId: "p2", variantId: null, name: "Nivea Soft Cream", variantName: null, sku: "NIV-SOFT-50", quantity: 2, unitPrice: 299, lineDiscount: 1, lineTotal: 597, imageUrl: null },
  ],
  subtotal: 2047,
  discountAmount: 0,
  shippingCharge: 0,
  vatAmount: 0,
  totalAmount: 2047,
  refundedAmount: 0,
  payments: [],
  shipment: null,
  shippingAddress: { fullName: "Ram Thapa", phone: "9800000002", address1: "Lakeside-6", city: "Pokhara" },
  notes: "Call before arriving",
  cancelReason: null,
  timeline: [],
  createdAt: "2026-10-18T06:15:30.000Z",
  updatedAt: "2026-10-18T06:15:30.000Z",
};
