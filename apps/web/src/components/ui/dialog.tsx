"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Accessible name for the dialog. */
  label?: string;
};

/** Modal dialog: role=dialog, Escape closes, focus moves in and is restored on close. */
export function Dialog({ open, onOpenChange, children, className, label }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChangeRef.current(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el || el.contains(document.activeElement)) return;
      const first = el.querySelector<HTMLElement>("[autofocus], input:not([type=hidden]):not([disabled]), select, textarea, button:not([data-dialog-close]):not([disabled])");
      (first ?? el).focus();
    }, 0);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn("relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl focus:outline-none", className)}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ children, className, onClose }: { children: ReactNode; className?: string; onClose?: () => void }) {
  return (
    <div className={cn("glass relative rounded-xl border border-border bg-card p-6 shadow-xl", className)}>
      {onClose && (
        <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose} aria-label="Close" data-dialog-close>
          <X className="h-4 w-4" />
        </Button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4 space-y-1 pr-10", className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>;
}

export function DialogDescription({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
