import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * One grammar for every status pill: amber = waiting on us, outlined ink = moving,
 * green = done, red = stopped, grey = closed. No solid fills — they shout louder than the order total.
 */
type Variant = "success" | "warning" | "danger" | "outline" | "muted";

const statusMap: Record<string, { label: string; variant: Variant }> = {
  // order
  PENDING: { label: "Pending", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "outline" },
  PROCESSING: { label: "Processing", variant: "outline" },
  PACKED: { label: "Packed", variant: "outline" },
  SHIPPED: { label: "Shipped", variant: "outline" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", variant: "outline" },
  DELIVERED: { label: "Delivered", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
  RETURNED: { label: "Returned", variant: "danger" },
  // payment
  PAID: { label: "Paid", variant: "success" },
  REFUNDED: { label: "Refunded", variant: "danger" },
  PARTIALLY_REFUNDED: { label: "Part refunded", variant: "warning" },
  FAILED: { label: "Failed", variant: "danger" },
  // shipment
  CREATING: { label: "Creating", variant: "muted" },
  ERROR: { label: "NCM problem", variant: "danger" },
  ORDER_CREATED: { label: "Booked", variant: "outline" },
  PICKED_UP: { label: "Picked up", variant: "outline" },
  IN_TRANSIT: { label: "In transit", variant: "outline" },
  ARRIVED_AT_HUB: { label: "At hub", variant: "outline" },
  RETURNED_TO_SENDER: { label: "Returned to sender", variant: "danger" },
  // stock problems from offline sales / misc
  open: { label: "To sort out", variant: "warning" },
  closed: { label: "Closed", variant: "muted" },
  resolved: { label: "Sorted", variant: "success" },
  conflict: { label: "Stock problem", variant: "danger" },
  error: { label: "Not accepted", variant: "danger" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const known = statusMap[status];
  const config = known ?? { label: status.replace(/_/g, " ").toLowerCase(), variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={cn("whitespace-nowrap", !known && "capitalize", className)}>
      {config.label}
    </Badge>
  );
}
