"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  FileText,
  LayoutDashboard,
  MapPin,
  Package,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Warehouse,
  Zap,
} from "lucide-react";
import { CUSTOMERS, INVOICES, NAV_SECTIONS, PRODUCTS } from "@/lib/mock-data";
import { hrefToFeature } from "@/lib/features";
import { useEffectiveFeatures } from "@/lib/use-entitlements";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Sparkles,
  BarChart3,
  Bell,
  Receipt,
  Zap,
  ShoppingCart,
  Users,
  Package,
  Boxes,
  Warehouse,
  Truck,
  Building2,
  UserCheck,
  MapPin,
  Smartphone,
  Wallet,
  FileText,
  Settings,
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const effective = useEffectiveFeatures();

  const navItems = NAV_SECTIONS.flatMap((s) => s.items).filter((item) => {
    const feature = hrefToFeature(item.href);
    if (!feature || feature === "dashboard") return true;
    return effective.includes(feature);
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const navigate = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <Command
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border glass shadow-2xl"
        shouldFilter
      >
        <div className="flex items-center border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, customers, products, invoices..."
            className="flex h-12 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[360px] overflow-y-auto p-2 scrollbar-thin">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group heading="Pages" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {navItems.map((item) => {
              const Icon = item.icon === "Shield" ? Shield : iconMap[item.icon] ?? LayoutDashboard;
              return (
                <Command.Item
                  key={item.href}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => navigate(item.href)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                    "aria-selected:bg-accent aria-selected:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Command.Item>
              );
            })}
          </Command.Group>

          <Command.Group heading="Customers" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {CUSTOMERS.map((c) => (
              <Command.Item
                key={c.id}
                value={`${c.name} ${c.code} ${c.area}`}
                onSelect={() => navigate(`/customers/${c.id}`)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span>{c.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.area}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Products" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {PRODUCTS.map((p) => (
              <Command.Item
                key={p.id}
                value={`${p.name} ${p.sku} ${p.brand}`}
                onSelect={() => navigate("/products")}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span>{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Invoices" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {INVOICES.map((inv) => (
              <Command.Item
                key={inv.id}
                value={`${inv.number} ${inv.customer}`}
                onSelect={() => navigate("/sales")}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
              >
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span>{inv.number}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{inv.customer}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
