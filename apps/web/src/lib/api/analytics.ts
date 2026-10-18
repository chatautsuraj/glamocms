/** POS analytics endpoints — see POS-API-CONTRACT.md. */
import { api, requestRaw, type Query } from "./client";
import type { AnalyticsSummary, BreakdownGroup, BreakdownRow, Channel, ReportData, ReportType } from "./types";

export interface RangeQuery {
  from?: string;
  to?: string;
  channel?: Channel | "";
}

export const analyticsApi = {
  summary: (q: RangeQuery) => api.get<AnalyticsSummary>("/pos/analytics/summary", q as unknown as Query),
  breakdown: (q: RangeQuery & { groupBy: BreakdownGroup }) => api.get<BreakdownRow[]>("/pos/analytics/breakdown", q as unknown as Query),
  report: (type: ReportType, q: RangeQuery) => api.get<ReportData>(`/pos/reports/${type}`, { ...q, format: "json" } as unknown as Query),
  async reportCsv(type: ReportType, q: RangeQuery): Promise<{ blob: Blob; filename: string }> {
    const res = await requestRaw("GET", `/pos/reports/${type}`, { query: { ...q, format: "csv" } as unknown as Query, raw: true });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return { blob: await res.blob(), filename: match?.[1] ?? `glamo-${type}.csv` };
  },
};
