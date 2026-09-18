"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatCardProps } from "./page-header";

export function StatCard({ title, value, change, icon: Icon, subtitle, className }: StatCardProps) {
  const positive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {change !== undefined && (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                positive ? "text-success" : "text-danger",
              )}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}% vs yesterday
            </div>
          )}
        </div>
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
      </div>
    </div>
  );
}
