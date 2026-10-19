"use client";

import type { Channel } from "@/lib/api/types";
import { CHANNEL_FILTERS } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** All / Counter / Website / WhatsApp / Phone segmented control. */
export function ChannelSwitcher({ value, onChange, label = "Channel", className }: { value: Channel | ""; onChange: (v: Channel | "") => void; label?: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1", className)}>
      {CHANNEL_FILTERS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-11 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
