"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function Sidebar({ collapsed, mobileOpen = false, onToggle }: { collapsed: boolean; mobileOpen?: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const permissions = useAuthStore((s) => s.permissions);
  const items = NAV.filter((n) => hasAny(permissions, n.anyOf));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:translate-x-0",
        mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full md:visible",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <Image src="/images/logo.png" alt="" width={40} height={24} className="h-6 w-10 shrink-0 object-contain" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold leading-tight">GLAMO POS</p>
            <p className="truncate text-[11px] text-muted-foreground">GLAMO Nepal</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (!sectionItems.length) return null;
          return (
            <div key={section} className="mb-4">
              {!collapsed && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section}</p>}
              <ul className="space-y-0.5">
                {sectionItems.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                          collapsed && "justify-center px-2",
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                        {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="hidden border-t border-sidebar-border p-3 md:block">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
