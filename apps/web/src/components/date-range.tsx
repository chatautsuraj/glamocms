"use client";

import { Input } from "@/components/ui/input";
import { addDays, kathmanduDay } from "@/lib/pos/math";
import { cn } from "@/lib/utils";

export type DayRange = { from: string; to: string };

export function presetRange(preset: "today" | "7d" | "30d" | "month"): DayRange {
  const today = kathmanduDay();
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") return { from: addDays(today, -6), to: today };
  if (preset === "30d") return { from: addDays(today, -29), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
] as const;

/** Kathmandu-day range picker (from/to are YYYY-MM-DD as the API expects). */
export function DateRangeControls({ value, onChange, className }: { value: DayRange; onChange: (r: DayRange) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Date presets">
        {PRESETS.map((p) => {
          const r = presetRange(p.key);
          const active = r.from === value.from && r.to === value.to;
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(r)}
              className={cn(
                "min-h-9 rounded-lg border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <label className="text-xs">
        <span className="sr-only">From</span>
        <Input type="date" className="h-9 w-[150px]" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} aria-label="From date" />
      </label>
      <label className="text-xs">
        <span className="sr-only">To</span>
        <Input type="date" className="h-9 w-[150px]" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} aria-label="To date" />
      </label>
    </div>
  );
}
