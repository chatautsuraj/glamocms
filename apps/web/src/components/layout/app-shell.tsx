"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { navItemFor } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { OfflineBanner } from "@/components/offline-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Full-height, edge-to-edge screens (the POS counter). */
const FULL_BLEED = new Set(["/pos"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED.has(pathname);
  // The counter needs every pixel: the sidebar starts collapsed there unless the user opened it.
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const collapsed = userCollapsed ?? fullBleed;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const label = navItemFor(pathname)?.label;
    document.title = label ? `${label} · GLAMO POS` : "GLAMO POS";
  }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh bg-background">
      {mobileOpen && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-ink-strong/40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setUserCollapsed(!collapsed)} />
      <div className={cn("flex min-w-0 flex-col transition-[padding] duration-200", collapsed ? "md:pl-[72px]" : "md:pl-60", fullBleed ? "h-dvh" : "min-h-dvh")}>
        <Topbar onMenuToggle={() => setMobileOpen((open) => !open)} mobileOpen={mobileOpen} />
        <main id="main" className={cn("min-w-0 flex-1", fullBleed ? "flex min-h-0 flex-col" : "p-4 md:p-6")}>
          <OfflineBanner className={fullBleed ? "m-3 mb-0" : undefined} />
          {fullBleed ? <div className="min-h-0 flex-1">{children}</div> : <div className="mx-auto w-full max-w-[1480px]">{children}</div>}
        </main>
      </div>
    </div>
  );
}
