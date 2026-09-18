import { cn } from "@/lib/utils";

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" | "muted" | "default" }> = {
  PAID: { label: "Paid", variant: "success" },
  ISSUED: { label: "Issued", variant: "default" },
  PARTIALLY_PAID: { label: "Partial", variant: "warning" },
  OVERDUE: { label: "Overdue", variant: "danger" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  DRAFT: { label: "Draft", variant: "muted" },
  FULFILLED: { label: "Fulfilled", variant: "success" },
  PARTIALLY_FULFILLED: { label: "Partial", variant: "warning" },
  INVOICED: { label: "Invoiced", variant: "default" },
  RECEIVED: { label: "Received", variant: "success" },
  ORDERED: { label: "Ordered", variant: "default" },
  PARTIALLY_RECEIVED: { label: "Partial", variant: "warning" },
  DELIVERED: { label: "Delivered", variant: "success" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", variant: "default" },
  SCHEDULED: { label: "Scheduled", variant: "secondary" },
  FAILED: { label: "Failed", variant: "danger" },
  APPROVED: { label: "Approved", variant: "success" },
  ok: { label: "In stock", variant: "success" },
  low: { label: "Low stock", variant: "warning" },
  critical: { label: "Critical", variant: "danger" },
};

import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusMap[status] ?? { label: status.replace(/_/g, " "), variant: "secondary" as const };
  return (
    <Badge variant={config.variant} className={cn("capitalize", className)}>
      {config.label}
    </Badge>
  );
}
