import type { BillData, PosConfig, PosOrder, StoreProfile } from "@/lib/api/types";
import { WALK_IN_NAME } from "./cart";

/** The bill snapshot stored with POS sales (`order.bill`), else an equivalent rebuilt from the order. */
export function billForOrder(order: PosOrder, store: StoreProfile, config: Pick<PosConfig, "vatEnabled" | "vatRate" | "taxInvoice" | "receiptFooter"> | null): BillData {
  const snap = order.bill as { bill?: BillData } | BillData | undefined;
  const stored = snap && "printableRef" in snap ? snap : (snap as { bill?: BillData } | undefined)?.bill;
  if (stored?.printableRef) {
    // v1 snapshots predate the VAT switch: they always carried VAT lines.
    const vatEnabled = stored.vatEnabled ?? stored.vatAmount > 0;
    return { ...stored, vatEnabled, taxInvoice: stored.taxInvoice ?? false, channel: order.channel };
  }
  const payments = order.payments.filter((p) => p.kind === "PAYMENT");
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const vatEnabled = order.vatAmount > 0 || Boolean(config?.vatEnabled);
  return {
    printableRef: order.printableRef || order.orderNumber,
    createdAt: order.createdAt ?? new Date().toISOString(),
    cashierName: order.cashier?.name ?? "",
    customer: { name: order.customer.name || WALK_IN_NAME, phone: order.customer.phone },
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
    vatRate: vatEnabled ? (config?.vatRate ?? 0) : 0,
    vatAmount: order.vatAmount,
    vatEnabled,
    taxInvoice: vatEnabled && Boolean(config?.taxInvoice),
    total: order.totalAmount,
    payments: payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })),
    tendered: payments.reduce((s, p) => s + (p.tendered ?? p.amount), 0),
    change: 0,
    due: Math.max(0, order.totalAmount - paid),
    footer: config?.receiptFooter ?? "",
    store,
    channel: order.channel,
  };
}
