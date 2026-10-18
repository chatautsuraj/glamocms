import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  if (pages <= 1) return <p className="text-xs text-muted-foreground">{total} total</p>;
  return (
    <nav aria-label="Pagination" className="flex items-center gap-2 text-sm">
      <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span aria-live="polite">Page {page} of {pages} · {total} total</span>
      <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
