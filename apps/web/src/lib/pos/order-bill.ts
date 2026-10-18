import type { BillData, PosOrder, StoreProfile } from "@/lib/api/types";

/** The bill snapshot stored with POS sales (`order.bill`), else an equivalent rebuilt from the order. */
export function billForOrder(order: PosOrder, store: StoreProfile, vatRate: number): BillData {
  const snap = order.bill as { bill?: BillData } | BillData | undefined;
  const stored = snap && "printableRef" in snap ? snap : (snap as { bill?: BillData } | undefined)?.bill;
  if (stored?.printableRef) return { ...stored, channel: order.channel };
  const payments = order.payments.filter((p) => p.kind === "PAYMENT");
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return {
    printableRef: order.printableRef || order.orderNumber,
    createdAt: order.createdAt ?? new Date().toISOString(),
    cashierName: order.cashier?.name ?? "",
    customer: { name: order.customer.name, phone: order.customer.phone },
    items: order.items.map((i) => ({
      name: i.variantName ? `${i.name} — ${i.variantName}` : i.name,
      sku: i.sku,
      qty: i.quantity,
      unitPrice: i.unitPrice,
      lineDiscount: i.lineDiscount,
      vatApplicable: true,
      lineTotal: i.lineTotal,
    })),
    subtotal: order.subtotal,
    discount: order.discountAmount,
    deliveryCharge: order.shippingCharge,
    taxableAmount: order.totalAmount - order.shippingCharge - order.vatAmount,
    vatRate,
    vatAmount: order.vatAmount,
    total: order.totalAmount,
    payments: payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })),
    tendered: payments.reduce((s, p) => s + (p.tendered ?? p.amount), 0),
    change: 0,
    due: Math.max(0, order.totalAmount - paid),
    footer: "",
    store,
    channel: order.channel,
  };
}
