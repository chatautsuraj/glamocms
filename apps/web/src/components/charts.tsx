"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChannelSwitcher } from "@/components/channel-switcher";
import { ErrorPanel } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Channel } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/labels";
import { downloadCsv } from "@/lib/notify";
import { useApi } from "@/lib/use-api";

/** Colour follows the channel entity (fixed order), never its rank. */
export const CHANNEL_COLOR: Record<Channel, string> = {
  POS_COUNTER: "var(--series-1)",
  WEBSITE: "var(--series-2)",
  WHATSAPP: "var(--series-3)",
  PHONE: "var(--series-4)",
  MANUAL: "var(--series-5)",
};

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const compact = (v: number) => formatNPR(v, true);

export interface TableSpec {
  columns: Array<{ key: string; label: string; money?: boolean }>;
  rows: Array<Record<string, unknown>>;
}

/**
 * Chart card with its own channel switcher (All/Counter/Website/WhatsApp/Phone),
 * table view (accessibility + exact values) and CSV export of what is shown.
 */
export function ChartCard<T>({ title, description, initialChannel, load, deps, render, table, filename }: {
  title: string;
  description?: string;
  initialChannel: Channel | "";
  load: (channel: Channel | "") => Promise<T>;
  deps: unknown[];
  render: (data: T, channel: Channel | "") => ReactNode;
  table: (data: T, channel: Channel | "") => TableSpec;
  filename: string;
}) {
  const [channel, setChannel] = useState<Channel | "">(initialChannel);
  const [showTable, setShowTable] = useState(false);
  useEffect(() => setChannel(initialChannel), [initialChannel]);
  const { data, error, loading, reload } = useApi(() => load(channel), [channel, ...deps]);
  const spec = useMemo(() => (data !== undefined ? table(data, channel) : null), [data, channel, table]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}><Table2 className="h-3.5 w-3.5" /> {showTable ? "Chart" : "Table"}</Button>
            <Button size="sm" variant="ghost" disabled={!spec?.rows.length} onClick={() => spec && downloadCsv(spec.rows, spec.columns.map((c) => c.key), `${filename}${channel ? `-${channel.toLowerCase()}` : ""}.csv`)}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>
        <ChannelSwitcher value={channel} onChange={setChannel} label={`${title} channel`} />
      </CardHeader>
      <CardContent>
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && data === undefined ? <Skeleton className="h-64 w-full" /> : data !== undefined && spec ? (
          !spec.rows.length ? <p className="py-16 text-center text-sm text-muted-foreground">No sales in this range.</p> : showTable ? <DataTableView spec={spec} /> : <div className="h-64" aria-hidden="false">{render(data, channel)}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DataTableView({ spec }: { spec: TableSpec }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-left text-xs font-medium text-muted-foreground">
          <tr className="border-b border-border">{spec.columns.map((c) => <th key={c.key} scope="col" className={`py-2 pr-3 ${c.money ? "text-right" : ""}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {spec.rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60">
              {spec.columns.map((c) => <td key={c.key} className={`py-1.5 pr-3 ${c.money ? "text-right tabular-nums" : ""}`}>{c.money ? formatNPR(Number(r[c.key] ?? 0)) : String(r[c.key] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{formatNPR(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Revenue per day, one 2px line per channel present (legend when ≥2 series). */
export function RevenueLines({ series }: { series: Array<{ date: string; channel: Channel; revenue: number }> }) {
  const channels = [...new Set(series.map((s) => s.channel))].sort((a, b) => Object.keys(CHANNEL_COLOR).indexOf(a) - Object.keys(CHANNEL_COLOR).indexOf(b));
  const byDate = new Map<string, Record<string, number | string>>();
  for (const s of series) {
    const row = byDate.get(s.date) ?? { date: s.date };
    row[s.channel] = (Number(row[s.channel]) || 0) + s.revenue;
    byDate.set(s.date, row);
  }
  const rows = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} width={56} />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
        {channels.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {channels.map((c) => (
          <Line key={c} type="monotone" dataKey={c} name={CHANNEL_LABEL[c]} stroke={CHANNEL_COLOR[c]} strokeWidth={2} dot={rows.length < 15 ? { r: 4, strokeWidth: 2, stroke: "var(--card)" } : false} activeDot={{ r: 5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for ranked breakdowns (single measure → single hue, labels name each bar). */
export function RankedBars({ rows, colorFor }: { rows: Array<{ label: string; revenue: number; key?: string }>; colorFor?: (key: string) => string }) {
  const data = rows.slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} />
        <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={130} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--accent)" }} />
        <Bar dataKey="revenue" name="Sales" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((r) => <Cell key={r.key ?? r.label} fill={colorFor?.(r.key ?? r.label) ?? "var(--series-1)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical bars over an ordered dimension (e.g. hour of day). */
export function ColumnBars({ rows }: { rows: Array<{ label: string; revenue: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} width={56} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--accent)" }} />
        <Bar dataKey="revenue" name="Sales" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
