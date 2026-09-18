"use client";

import { use, type ComponentType } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CollectionReport,
  DailySalesReport,
  LowStockReport,
  OutstandingAgingReport,
  ProfitLossReport,
  PurchaseAnalysisReport,
  SalesByCustomerReport,
  SalesByProductReport,
  StockMovementReport,
  VatReport,
} from "@/components/reports/report-views";
import { REPORT_BY_SLUG } from "@/lib/reports";
import { useVatEnabled } from "@/lib/use-entitlements";

const VIEWS: Record<string, ComponentType> = {
  "daily-sales": DailySalesReport,
  "sales-by-customer": SalesByCustomerReport,
  "sales-by-product": SalesByProductReport,
  collection: CollectionReport,
  "outstanding-aging": OutstandingAgingReport,
  "profit-loss": ProfitLossReport,
  vat: VatReport,
  "stock-movement": StockMovementReport,
  "low-stock": LowStockReport,
  "purchase-analysis": PurchaseAnalysisReport,
};

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const vatEnabled = useVatEnabled();
  const report = REPORT_BY_SLUG[slug];
  const View = VIEWS[slug];

  if (!report || !View) notFound();
  if (slug === "vat" && !vatEnabled) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to reports
          </Button>
        </Link>
        <PageHeader
          title={report.name}
          description={report.desc}
          actions={<Badge variant="muted">{report.tag}</Badge>}
        />
      </div>
      <View />
    </div>
  );
}
