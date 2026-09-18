"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getReportCategories } from "@/lib/reports";
import { useVatEnabled } from "@/lib/use-entitlements";

export default function ReportsPage() {
  const vatEnabled = useVatEnabled();
  const categories = getReportCategories({ vatEnabled });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Generate and export business reports"
      />

      {categories.map((cat) => (
        <div key={cat.category}>
          <h2 className="mb-4 text-lg font-semibold">{cat.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cat.reports.map((report) => (
              <Link key={report.slug} href={`/reports/${report.slug}`}>
                <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="rounded-xl bg-primary/10 p-2">
                        <report.icon className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="muted">{report.tag}</Badge>
                    </div>
                    <CardTitle className="text-sm">{report.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{report.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
