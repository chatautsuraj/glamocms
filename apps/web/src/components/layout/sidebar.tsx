"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Zap,
} from "lucide-react";
import { hrefToFeature } from "@/lib/features";
import { NAV_SECTIONS } from "@/lib/mock-data";
import {
  useCanAccessAdmin,
  useEffectiveFeatures,
  useStoreUser,
} from "@/lib/use-entitlements";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Zap,
  Receipt,
  BarChart3,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Shield,
  Settings,
  FileBarChart,
};

type SidebarProps = {
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, mobileOpen = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const effective = useEffectiveFeatures();
  const storeUser = useStoreUser();
  const canAdmin = useCanAccessAdmin();
  const privileged =
    storeUser?.role === "OWNER" ||
    storeUser?.role === "ADMIN" ||
    storeUser?.role === "PLATFORM_ADMIN";

  const sections = useMemo(() => {
    const canSee = (href: string) => {
      const feature = hrefToFeature(href);
      if (!feature || feature === "dashboard") return true;
      if (feature === "admin") return canAdmin;
      if (privileged) return true;
      return effective.includes(feature);
    };
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => canSee(item.href)),
    })).filter((section) => section.items.length > 0);
  }, [effective, canAdmin, privileged]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderLink = (href: string, label: string, icon: string, active: boolean) => {
    const Icon = iconMap[icon] ?? LayoutDashboard;
    const link = (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
          collapsed && "justify-center px-2",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
    return collapsed ? (
      <Tooltip content={label} side="bottom">
        {link}
      </Tooltip>
    ) : (
      link
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:translate-x-0",
        mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full md:visible",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#9f2d4a] to-[#c45c4a] shadow-sm">
          <span className="font-display text-base font-bold text-primary-foreground">G</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold leading-tight text-foreground">
              Glamo Nepal
            </p>
            <p className="truncate text-[11px] text-muted-foreground">Store CMS + POS</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  {renderLink(item.href, item.label, item.icon, isActive(item.href))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
