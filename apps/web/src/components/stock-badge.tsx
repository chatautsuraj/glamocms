import { Badge } from "@/components/ui/badge";

/** "12 in stock" / "Low · 2" / "Out of stock" from on-hand vs reorder level. */
export function StockBadge({ stock, threshold, track = true }: { stock: number; threshold: number; track?: boolean }) {
  if (!track) return <Badge variant="muted">Not counted</Badge>;
  if (stock <= 0) return <Badge variant="danger">Out of stock</Badge>;
  if (stock <= threshold) return <Badge variant="warning">Low · {stock}</Badge>;
  return <Badge variant="success">{stock} in stock</Badge>;
}
