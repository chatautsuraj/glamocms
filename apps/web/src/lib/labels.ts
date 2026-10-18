import type { Channel, OrderStatus, PaymentMethod } from "@/lib/api/types";

export const CHANNEL_LABEL: Record<Channel, string> = {
  POS_COUNTER: "Counter",
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  PHONE: "Phone",
  MANUAL: "Manual",
};

/** Channel switcher options used on every chart / report. */
export const CHANNEL_FILTERS: Array<{ value: Channel | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "POS_COUNTER", label: "Counter" },
  { value: "WEBSITE", label: "Website" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE", label: "Phone" },
];

export const PAYMENT_LABEL: Record<PaymentMethod | "CASH_ON_DELIVERY", string> = {
  CASH: "Cash",
  FONEPAY_QR: "Fonepay",
  KHALTI: "Khalti",
  ESEWA: "eSewa",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CASH_ON_DELIVERY: "Cash on delivery",
};

export const paymentLabel = (m: string) => PAYMENT_LABEL[m as PaymentMethod] ?? m.replace(/_/g, " ");

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

/** Forward transitions allowed via PATCH /pos/orders/:id/status (cancel has its own endpoint). */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["PROCESSING", "PACKED"],
  PROCESSING: ["PACKED"],
  PACKED: ["SHIPPED", "OUT_FOR_DELIVERY", "RETURNED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export const SHIPMENT_LABEL: Record<string, string> = {
  CREATING: "Creating",
  ERROR: "Error",
  ORDER_CREATED: "Booked with NCM",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  ARRIVED_AT_HUB: "At hub",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RETURNED_TO_SENDER: "Returned to sender",
};

export const SHIPMENT_STAGES = ["ORDER_CREATED", "PICKED_UP", "IN_TRANSIT", "ARRIVED_AT_HUB", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
