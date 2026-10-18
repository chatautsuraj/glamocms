import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "secondary" | "muted" | "default";

const statusMap: Record<string, { label: string; variant: Variant }> = {
  // order
  PENDING: { label: "Pending", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "default" },
  PROCESSING: { label: "Processing", variant: "secondary" },
  PACKED: { label: "Packed", variant: "secondary" },
  SHIPPED: { label: "Shipped", variant: "default" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", variant: "default" },
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
  ERROR: { label: "NCM error", variant: "danger" },
  ORDER_CREATED: { label: "Booked", variant: "secondary" },
  PICKED_UP: { label: "Picked up", variant: "default" },
  IN_TRANSIT: { label: "In transit", variant: "default" },
  ARRIVED_AT_HUB: { label: "At hub", variant: "default" },
  RETURNED_TO_SENDER: { label: "Returned to sender", variant: "danger" },
  // stock / till / misc
  ok: { label: "In stock", variant: "success" },
  low: { label: "Low stock", variant: "warning" },
  out: { label: "Out of stock", variant: "danger" },
  open: { label: "Open", variant: "warning" },
  closed: { label: "Closed", variant: "muted" },
  resolved: { label: "Resolved", variant: "success" },
  conflict: { label: "Conflict", variant: "danger" },
  error: { label: "Rejected", variant: "danger" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusMap[status] ?? { label: status.replace(/_/g, " ").toLowerCase(), variant: "secondary" as const };
  return (
    <Badge variant={config.variant} className={cn("whitespace-nowrap capitalize", className)}>
      {config.label}
    </Badge>
  );
}
