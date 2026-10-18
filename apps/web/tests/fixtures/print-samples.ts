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
