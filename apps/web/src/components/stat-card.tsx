import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatCardProps = {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  subtitle?: string;
  loading?: boolean;
  className?: string;
};

export function StatCard({ title, value, icon: Icon, subtitle, loading, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? <Skeleton className="h-8 w-28" /> : <p className="tabular text-2xl font-bold tracking-tight">{value}</p>}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="shrink-0 rounded-full bg-rose-tint p-2.5">
            <Icon className="h-5 w-5 text-foreground" aria-hidden />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
