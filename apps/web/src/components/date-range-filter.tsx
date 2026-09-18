"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DATE_PRESET_OPTIONS,
  type DatePreset,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

type DateRangeFilterProps = {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  className?: string;
};

export function DateRangeFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  className,
}: DateRangeFilterProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {DATE_PRESET_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            type="button"
            variant={preset === opt.value ? "default" : "outline"}
            onClick={() => onPresetChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="w-auto"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="w-auto"
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}
