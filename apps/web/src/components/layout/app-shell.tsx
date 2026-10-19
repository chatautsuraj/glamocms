"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { navItemFor } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
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
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh bg-background">
      <div inert={mobileOpen} className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setUserCollapsed(!collapsed)} />
      </div>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen} label="Main navigation" className="fixed inset-y-0 left-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3rem))] max-w-none rounded-none bg-sidebar sm:rounded-none">
        <Sidebar collapsed={false} mobileOpen onToggle={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
      </Dialog>
      <div inert={mobileOpen} className={cn("flex min-w-0 flex-col", collapsed ? "md:pl-[72px]" : "md:pl-60", fullBleed ? "h-dvh" : "min-h-dvh")}>
        <Topbar onMenuToggle={() => setMobileOpen((open) => !open)} mobileOpen={mobileOpen} />
        <main id="main" tabIndex={-1} className={cn("min-w-0 flex-1", fullBleed ? "flex min-h-0 flex-col" : "p-4 md:p-6")}>
          <OfflineBanner className={fullBleed ? "m-3 mb-0" : undefined} />
          {fullBleed ? <div className="min-h-0 flex-1">{children}</div> : <div className="mx-auto w-full max-w-[1480px]">{children}</div>}
        </main>
      </div>
    </div>
  );
}
