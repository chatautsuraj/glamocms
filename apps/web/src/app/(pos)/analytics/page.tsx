"use client";

import { useCallback, useState } from "react";
import { BadgePercent, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { ChannelSwitcher } from "@/components/channel-switcher";
import { CHANNEL_COLOR, ChartCard, ColumnBars, RankedBars, RevenueLines, type TableSpec } from "@/components/charts";
import { DateRangeControls, presetRange, type DayRange } from "@/components/date-range";
import { ErrorPanel } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { analyticsApi } from "@/lib/api/analytics";
import type { AnalyticsSummary, BreakdownGroup, BreakdownRow, Channel } from "@/lib/api/types";
import { formatNPR, formatNumber } from "@/lib/format";
import { CHANNEL_LABEL, paymentLabel } from "@/lib/labels";
import { useApi } from "@/lib/use-api";

const breakdownTable = (rows: BreakdownRow[]): TableSpec => ({
  columns: [
    { key: "label", label: "Name" }, { key: "revenue", label: "Revenue", money: true }, { key: "orders", label: "Orders" },
    { key: "items", label: "Items" }, { key: "margin", label: "Margin", money: true },
  ],
  rows: rows as unknown as Array<Record<string, unknown>>,
});

export default function AnalyticsPage() {
  const [range, setRange] = useState<DayRange>(presetRange("30d"));
  const [channel, setChannel] = useState<Channel | "">("");
  const summary = useApi(() => analyticsApi.summary({ ...range, channel }), [range.from, range.to, channel]);
  const t = summary.data?.totals;

  const loadSummary = useCallback((ch: Channel | "") => analyticsApi.summary({ ...range, channel: ch }), [range]);
  const breakdown = (groupBy: BreakdownGroup) => (ch: Channel | "") => analyticsApi.breakdown({ ...range, channel: ch, groupBy });

  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" description="Gross revenue = paid or refunded orders that weren't cancelled. Kathmandu business days." />
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
          <DateRangeControls value={range} onChange={setRange} />
          <ChannelSwitcher value={channel} onChange={setChannel} label="Channel for all charts" />
        </CardContent>
      </Card>
      {summary.error ? <ErrorPanel error={summary.error} onRetry={summary.reload} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Revenue" value={t ? formatNPR(t.revenue) : "…"} icon={TrendingUp} subtitle={t?.netRevenue !== undefined ? `Net ${formatNPR(t.netRevenue)} after refunds` : undefined} />
          <StatCard title="Orders" value={t ? formatNumber(t.orders) : "…"} icon={Receipt} subtitle={t ? `${formatNumber(t.items)} items` : undefined} />
          <StatCard title="Average order" value={t ? formatNPR(t.aov) : "…"} icon={ShoppingBag} />
          <StatCard title="Gross margin" value={t ? formatNPR(t.grossMargin) : "…"} icon={BadgePercent} subtitle={t ? `VAT ${formatNPR(t.vat)} · discounts ${formatNPR(t.discounts)} · refunds ${formatNPR(t.refunds)}` : undefined} />
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard<AnalyticsSummary>
          title="Revenue over time" description="Per day, by channel" initialChannel={channel} load={loadSummary} deps={[range.from, range.to]} filename={`glamo-revenue-${range.from}_${range.to}`}
          render={(d) => <RevenueLines series={d.series} />}
          table={(d) => ({ columns: [{ key: "date", label: "Date" }, { key: "channelLabel", label: "Channel" }, { key: "revenue", label: "Revenue", money: true }, { key: "orders", label: "Orders" }], rows: d.series.map((s) => ({ ...s, channelLabel: CHANNEL_LABEL[s.channel] ?? s.channel })) })}
        />
        <ChartCard<AnalyticsSummary>
          title="Revenue by channel" initialChannel={channel} load={loadSummary} deps={[range.from, range.to]} filename={`glamo-channels-${range.from}_${range.to}`}
          render={(d) => <RankedBars rows={d.byChannel.map((c) => ({ key: c.channel, label: CHANNEL_LABEL[c.channel] ?? c.channel, revenue: c.revenue }))} colorFor={(k) => CHANNEL_COLOR[k as Channel] ?? "var(--series-1)"} />}
          table={(d) => ({ columns: [{ key: "label", label: "Channel" }, { key: "revenue", label: "Revenue", money: true }, { key: "orders", label: "Orders" }, { key: "aov", label: "AOV", money: true }, { key: "items", label: "Items" }], rows: d.byChannel.map((c) => ({ ...c, label: CHANNEL_LABEL[c.channel] ?? c.channel })) })}
        />
        <ChartCard<BreakdownRow[]>
          title="Top products" initialChannel={channel} load={breakdown("product")} deps={[range.from, range.to]} filename={`glamo-products-${range.from}_${range.to}`}
          render={(rows) => <RankedBars rows={rows} />} table={breakdownTable}
        />
        <ChartCard<BreakdownRow[]>
          title="Categories" initialChannel={channel} load={breakdown("category")} deps={[range.from, range.to]} filename={`glamo-categories-${range.from}_${range.to}`}
          render={(rows) => <RankedBars rows={rows} />} table={breakdownTable}
        />
        <ChartCard<BreakdownRow[]>
          title="Payment methods" initialChannel={channel} load={breakdown("payment")} deps={[range.from, range.to]} filename={`glamo-payments-${range.from}_${range.to}`}
          render={(rows) => <RankedBars rows={rows.map((r) => ({ ...r, label: paymentLabel(r.label || r.key) }))} />} table={breakdownTable}
        />
        <ChartCard<BreakdownRow[]>
          title="Staff" description="Revenue per cashier" initialChannel={channel} load={breakdown("staff")} deps={[range.from, range.to]} filename={`glamo-staff-${range.from}_${range.to}`}
          render={(rows) => <RankedBars rows={rows} />} table={breakdownTable}
        />
        <ChartCard<BreakdownRow[]>
          title="Sales by hour" description="Kathmandu time" initialChannel={channel} load={breakdown("hour")} deps={[range.from, range.to]} filename={`glamo-hours-${range.from}_${range.to}`}
          render={(rows) => <ColumnBars rows={[...rows].sort((a, b) => Number(a.key) - Number(b.key)).map((r) => ({ label: r.label || r.key, revenue: r.revenue }))} />} table={breakdownTable}
        />
      </div>
    </div>
  );
}
