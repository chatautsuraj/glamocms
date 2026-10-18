"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CloseContext = createContext<() => void>(() => undefined);

type DropdownMenuProps = {
  /** Render prop gets the toggle handler and ARIA state for the trigger button. */
  trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu"; "aria-controls": string }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
};

/** Small menu: closes on outside click, Escape and item click. */
export function DropdownMenu({ trigger, children, align = "end", className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu", "aria-controls": id })}
      {open && (
        <div
          id={id}
          role="menu"
          className={cn("absolute z-50 mt-2 min-w-[220px] animate-pop-in rounded-xl border border-border bg-popover p-1 shadow-pop", align === "end" ? "right-0" : "left-0", className)}
        >
          <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({ children, onClick, className, destructive, keepOpen }: { children: ReactNode; onClick?: () => void; className?: string; destructive?: boolean; keepOpen?: boolean }) {
  const close = useContext(CloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onClick?.();
        if (!keepOpen) close();
      }}
      className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none", destructive && "text-danger hover:bg-danger/10", className)}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
