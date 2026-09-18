"use client";

import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onChange, disabled, ...props }, ref) => (
    <label
      className={cn(
        "relative inline-flex items-center",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <div
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border border-input bg-card transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          className
        )}
      >
        <Check
          className={cn(
            "h-3 w-3 text-primary-foreground transition-opacity",
            checked ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </label>
  )
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
