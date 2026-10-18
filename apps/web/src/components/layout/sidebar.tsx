"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Boxes, ChevronLeft, ChevronRight, FileBarChart, LayoutDashboard, MessageCircle, Package, Phone, Receipt,
  ScanLine, Settings, Truck, Users,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";
import { NAV, hasAny } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ScanLine, Receipt, Users, Phone, Package, Boxes, Truck, MessageCircle, BarChart3, FileBarChart, Settings,
};

const SECTIONS = ["Sell", "Commerce", "Channels", "Insights", "Admin"] as const;
const SECTION_LABEL: Record<(typeof SECTIONS)[number], string> = {
  Sell: "Sell",
  Commerce: "Stock & orders",
  Channels: "Delivery & chat",
  Insights: "Reports",
  Admin: "Admin",
};

/** Store logo from Settings, falling back to the bundled GLAMO logo (never a broken image). */
function StoreLogo({ src }: { src: string | undefined }) {
  const [failed, setFailed] = useState(false);
  const url = src && !failed ? src : "/images/logo.png";
  // eslint-disable-next-line @next/next/no-img-element -- remote logo URL from settings
  return <img src={url} alt="" width={40} height={24} onError={() => setFailed(true)} className="h-7 w-11 shrink-0 object-contain" />;
}

export function Sidebar({ collapsed, mobileOpen = false, onToggle }: { collapsed: boolean; mobileOpen?: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const permissions = useAuthStore((s) => s.permissions);
  const store = useAuthStore((s) => s.store);
  const items = NAV.filter((n) => hasAny(permissions, n.anyOf));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // On phones the drawer always shows labels.
  const compact = collapsed && !mobileOpen;

  return (
    <aside
      aria-label="Main menu"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 md:translate-x-0",
        mobileOpen ? "visible w-64 translate-x-0" : "invisible -translate-x-full md:visible",
        !mobileOpen && (collapsed ? "md:w-[72px]" : "md:w-60"),
      )}
    >
      <div className={cn("flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4", compact && "justify-center px-2")}>
        <StoreLogo src={store?.logoUrl} />
        {!compact && (
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold leading-none tracking-wide">GLAMO POS</p>
            <p className="truncate text-xs text-muted-foreground">{store?.name}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (!sectionItems.length) return null;
          return (
            <div key={section} className="mb-3">
              {!compact ? <p className="mb-1 px-3 pt-1 text-xs font-medium text-muted-foreground">{SECTION_LABEL[section]}</p> : <div className="mx-3 mb-2 h-px bg-sidebar-border" aria-hidden />}
              <ul className="space-y-0.5">
                {sectionItems.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        title={compact ? item.label : undefined}
                        className={cn(
                          "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-rose" : "text-sidebar-foreground hover:bg-accent",
                          compact && "justify-center px-2",
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {compact ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="hidden border-t border-sidebar-border p-2 md:block">
        <button
          type="button"
          aria-label={collapsed ? "Show menu labels" : "Hide menu labels"}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Hide labels</span></>}
        </button>
      </div>
    </aside>
  );
}
