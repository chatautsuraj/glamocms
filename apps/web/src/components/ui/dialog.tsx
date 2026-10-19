"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
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

/** Open dialogs, innermost last: only the top one reacts to Escape / traps Tab. */
const stack: string[] = [];

/** True while any modal layer is open (screens use it to pause shortcuts). */
export function isModalOpen() {
  return stack.length > 0;
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Registers a modal layer: Escape closes only the top-most layer, Tab is
 * trapped inside `panel`, focus moves in on open and is restored on close.
 */
export function useModalLayer(open: boolean, onClose: () => void, panel: RefObject<HTMLElement | null>) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(id);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === "Escape") {
        // Inputs that use Escape themselves (e.g. "add new category") opt out.
        if ((e.target as HTMLElement | null)?.closest?.("[data-escape-local]")) return;
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el || el.contains(document.activeElement)) return;
      const first = el.querySelector<HTMLElement>("[autofocus], [data-autofocus], input:not([type=hidden]):not([disabled]), select, textarea, button:not([data-dialog-close]):not([disabled])");
      (first ?? el).focus();
    }, 0);
    return () => {
      const at = stack.lastIndexOf(id);
      if (at >= 0) stack.splice(at, 1);
      if (!stack.length) document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey, true);
      window.clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, id, panel]);
}

/** Modal dialog: role=dialog, Escape closes, Tab is trapped, focus moves in and is restored on close. */
export function Dialog({ open, onOpenChange, children, className, label }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  useModalLayer(open, () => onOpenChange(false), panel);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-ink-strong/50 dark:bg-black/70" onClick={() => onOpenChange(false)} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn("relative z-10 max-h-[94dvh] w-full max-w-lg animate-pop-in overflow-y-auto rounded-t-2xl focus:outline-none sm:rounded-xl", className)}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ children, className, onClose }: { children: ReactNode; className?: string; onClose?: () => void }) {
  return (
    <div className={cn("relative rounded-t-2xl border border-border bg-card p-5 shadow-pop sm:rounded-xl sm:p-6", className)}>
      {onClose && (
        <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={onClose} aria-label="Close" data-dialog-close>
          <X className="h-5 w-5" />
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
  return <h2 className={cn("text-lg font-semibold leading-snug", className)}>{children}</h2>;
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}
