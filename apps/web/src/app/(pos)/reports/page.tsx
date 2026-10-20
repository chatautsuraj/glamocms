"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { ChannelSwitcher } from "@/components/channel-switcher";
import { DateRangeControls, presetRange, type DayRange } from "@/components/date-range";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyticsApi } from "@/lib/api/analytics";
import type { Channel, ReportType } from "@/lib/api/types";
import { formatDateTime, formatNPR, formatNumber } from "@/lib/format";
import { paymentLabel } from "@/lib/labels";
import { downloadBlob, toastError } from "@/lib/notify";
import { useApi } from "@/lib/use-api";

const REPORTS: Array<{ type: ReportType; label: string; hint: string; channel: boolean }> = [
  { type: "sales", label: "Sales", hint: "Every order with channel, cashier, totals and payment.", channel: true },
  { type: "vat", label: "VAT", hint: "Taxable amount and VAT per day, for your VAT return.", channel: true },
  { type: "products", label: "Products", hint: "Sales, units and gross profit per product.", channel: true },
  { type: "till", label: "Cash drawer", hint: "Starting cash, cash sales, what should be in the drawer, what was counted, and the difference.", channel: false },
  { type: "inventory", label: "Stock", hint: "Stock right now and its value at cost and at selling price.", channel: false },
];

const MONEY = /amount|total|revenue|price|cash|float|variance|vat|value|margin|discount|charge|sales|refunds|cost|subtotal|shipping/i;
const NOT_MONEY = /^(orders|bills|items|stock|lowStockThreshold|cashierName)$/;

/** Plain headers for the API's column keys. */
const COLUMN_LABEL: Record<string, string> = {
  openingFloat: "Starting cash", cashSales: "Cash sales", expectedCash: "Should be in drawer", closingCash: "Counted", variance: "Difference",
  cashierName: "Cashier", openedAt: "Started", closedAt: "Counted at", byMethod: "By payment", lowStockThreshold: "Warn at",
  costPrice: "Cost", stockValueCost: "Stock value (cost)", stockValueRetail: "Stock value (selling)", isActive: "Active", posVisible: "At counter",
  paymentStatus: "Payment", paymentMethod: "Paid by", ref: "Bill no.", taxableAmount: "Taxable", vatAmount: "VAT", exemptAmount: "VAT free",
  revenue: "Sales", margin: "Gross profit", key: "Code", label: "Name", id: "ID", sku: "SKU",
};

function columnLabel(key: string) {
  if (COLUMN_LABEL[key]) return COLUMN_LABEL[key];
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const isMoney = (key: string) => MONEY.test(key) && !NOT_MONEY.test(key);

function cellText(key: string, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return isMoney(key) ? formatNPR(v) : formatNumber(v);
  if (typeof v === "string" && /At$/.test(key) && !Number.isNaN(Date.parse(v))) return formatDateTime(v);
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, n]) => `${paymentLabel(k)}: ${typeof n === "number" ? formatNPR(n) : String(n)}`).join(" · ");
  return String(v);
}

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>("sales");
  const [range, setRange] = useState<DayRange>(presetRange("month"));
  const [channel, setChannel] = useState<Channel | "">("");
  const [downloading, setDownloading] = useState(false);
  const meta = REPORTS.find((r) => r.type === type)!;
  const ch = meta.channel ? channel : "";
  const { data, error, loading, reload } = useApi(() => analyticsApi.report(type, { ...range, channel: ch }), [type, range.from, range.to, ch]);

  const csv = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await analyticsApi.reportCsv(type, { ...range, channel: ch });
      downloadBlob(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toastError(err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description={meta.hint} actions={<Button onClick={csv} disabled={downloading}><Download className="h-4 w-4" aria-hidden /> {downloading ? "Preparing…" : "Download for Excel (CSV)"}</Button>} />
      <Card>
        <CardContent className="space-y-3 p-4">
          <Tabs panels={false} value={type} onValueChange={(v) => setType(v as ReportType)}>
            <TabsList label="Report">{REPORTS.map((r) => <TabsTrigger key={r.type} value={r.type}>{r.label}</TabsTrigger>)}</TabsList>
          </Tabs>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <DateRangeControls value={range} onChange={setRange} />
            {meta.channel && <ChannelSwitcher value={channel} onChange={setChannel} />}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows rows={8} /> : data && (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{meta.label} report {data.range.from} to {data.range.to}</caption>
                <thead className="sticky top-0 bg-card text-left text-xs font-medium text-muted-foreground">
                  <tr className="border-b border-border">{data.columns.map((c) => <th key={c} scope="col" className={`whitespace-nowrap py-2 pr-3 ${isMoney(c) ? "text-right" : ""}`}>{columnLabel(c)}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/60">
                      {data.columns.map((c) => {
                        const v = r[c];
                        return <td key={c} className={`whitespace-nowrap py-1.5 pr-3 ${typeof v === "number" ? "text-right tabular-nums" : ""}`}>{cellText(c, v)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.rows.length && <p className="py-8 text-center text-sm text-muted-foreground">No rows for this range.</p>}
              <p className="mt-2 text-xs text-muted-foreground">{formatNumber(data.rows.length)} rows · {data.range.from} to {data.range.to}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
