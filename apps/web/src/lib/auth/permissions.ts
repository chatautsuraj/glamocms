/** Route → permission gating shared by the sidebar, page guard and tests. */
import type { Permission } from "@/lib/api/types";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Any one of these grants access. */
  anyOf: Permission[];
  section: "Sell" | "Commerce" | "Insights" | "Channels" | "Admin";
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", anyOf: ["pos.sell"], section: "Sell" },
  { href: "/pos", label: "POS", icon: "ScanLine", anyOf: ["pos.sell"], section: "Sell" },
  { href: "/orders", label: "Orders", icon: "Receipt", anyOf: ["orders.read.own", "orders.read.all"], section: "Sell" },
  { href: "/customers", label: "Customers", icon: "Users", anyOf: ["pos.sell"], section: "Sell" },
  { href: "/phone", label: "Phone orders", icon: "Phone", anyOf: ["orders.write"], section: "Commerce" },
  { href: "/products", label: "Products", icon: "Package", anyOf: ["catalog.write"], section: "Commerce" },
  { href: "/inventory", label: "Stock", icon: "Boxes", anyOf: ["inventory.write"], section: "Commerce" },
  { href: "/delivery", label: "Delivery", icon: "Truck", anyOf: ["delivery.manage"], section: "Channels" },
  { href: "/whatsapp", label: "WhatsApp", icon: "MessageCircle", anyOf: ["whatsapp.inbox"], section: "Channels" },
  { href: "/marketing", label: "Email campaigns", icon: "Mail", anyOf: ["settings.read"], section: "Channels" },
  { href: "/analytics", label: "Analytics", icon: "BarChart3", anyOf: ["analytics.read"], section: "Insights" },
  { href: "/reports", label: "Reports", icon: "FileBarChart", anyOf: ["reports.read"], section: "Insights" },
  { href: "/settings", label: "Settings", icon: "Settings", anyOf: ["settings.read", "staff.manage"], section: "Admin" },
];

export function hasAny(perms: readonly string[], anyOf: readonly Permission[]) {
  return anyOf.some((p) => perms.includes(p));
}

/** Nav item that owns `pathname` (longest prefix match), if any. */
export function navItemFor(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function canAccessPath(perms: readonly string[], pathname: string) {
  const item = navItemFor(pathname);
  return item ? hasAny(perms, item.anyOf) : true;
}

/** First page the user may open — cashiers land on the POS screen. */
export function homeFor(perms: readonly string[]) {
  if (perms.includes("analytics.read")) return "/dashboard";
  if (perms.includes("pos.sell")) return "/pos";
  return NAV.find((n) => hasAny(perms, n.anyOf))?.href ?? "/login";
}
