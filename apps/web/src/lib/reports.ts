import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FileText,
  Package,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

export type ReportCategory = "sales" | "finance" | "operations";

export type ReportDef = {
  slug: string;
  name: string;
  desc: string;
  tag: string;
  category: ReportCategory;
  categoryTitle: string;
  icon: LucideIcon;
};

export const REPORTS: ReportDef[] = [
  {
    slug: "daily-sales",
    name: "Daily Sales Summary",
    desc: "Counter and field sales by date",
    tag: "Daily",
    category: "sales",
    categoryTitle: "Sales Reports",
    icon: Receipt,
  },
  {
    slug: "sales-by-customer",
    name: "Sales by Customer",
    desc: "Revenue breakdown by account",
    tag: "Weekly",
    category: "sales",
    categoryTitle: "Sales Reports",
    icon: Users,
  },
  {
    slug: "sales-by-product",
    name: "Sales by Product",
    desc: "SKU-wise volume and revenue",
    tag: "Weekly",
    category: "sales",
    categoryTitle: "Sales Reports",
    icon: Package,
  },
  {
    slug: "collection",
    name: "Collection Report",
    desc: "Cash, credit, and QR collections",
    tag: "Daily",
    category: "finance",
    categoryTitle: "Finance Reports",
    icon: Wallet,
  },
  {
    slug: "outstanding-aging",
    name: "Outstanding Aging",
    desc: "Receivables by age bucket",
    tag: "Weekly",
    category: "finance",
    categoryTitle: "Finance Reports",
    icon: FileText,
  },
  {
    slug: "profit-loss",
    name: "Profit & Loss",
    desc: "Revenue, COGS, and margins",
    tag: "Monthly",
    category: "finance",
    categoryTitle: "Finance Reports",
    icon: BarChart3,
  },
  {
    slug: "vat",
    name: "VAT Report",
    desc: "13% VAT summary for IRD filing",
    tag: "Monthly",
    category: "finance",
    categoryTitle: "Finance Reports",
    icon: FileText,
  },
  {
    slug: "stock-movement",
    name: "Stock Movement",
    desc: "In/out by location",
    tag: "Weekly",
    category: "operations",
    categoryTitle: "Operations Reports",
    icon: Package,
  },
  {
    slug: "low-stock",
    name: "Low Stock Alert",
    desc: "SKUs below reorder point",
    tag: "Daily",
    category: "operations",
    categoryTitle: "Operations Reports",
    icon: Package,
  },
  {
    slug: "purchase-analysis",
    name: "Purchase Analysis",
    desc: "PO vs GRN variance",
    tag: "Monthly",
    category: "operations",
    categoryTitle: "Operations Reports",
    icon: FileText,
  },
];

export const REPORT_BY_SLUG = Object.fromEntries(
  REPORTS.map((r) => [r.slug, r])
) as Record<string, ReportDef>;

export function getReportCategories(options?: { vatEnabled?: boolean }) {
  const vatEnabled = options?.vatEnabled !== false;
  const order: ReportCategory[] = ["sales", "finance", "operations"];
  return order.map((category) => {
    const reports = REPORTS.filter(
      (r) => r.category === category && (vatEnabled || r.slug !== "vat")
    );
    return {
      category,
      title: reports[0]?.categoryTitle ?? category,
      reports,
    };
  });
}
