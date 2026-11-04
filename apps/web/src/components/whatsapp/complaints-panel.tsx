"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { WaComplaint } from "@/lib/api/types";
import { whatsappApi, type WaComplaintStatus } from "@/lib/api/whatsapp";
import { formatDateTime, formatNumber } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { complaintSla } from "@/lib/whatsapp-digest";

const PAGE_SIZE = 30;

const STATUS_OPTIONS: Array<{ value: WaComplaintStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const categoryLabel = (category: string) => category.replace(/_/g, " ");

function ComplaintStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1.5 text-2xl font-semibold", tone)}>{formatNumber(value)}</p>
    </div>
  );
}

export function WhatsAppComplaintsPanel({ onOpenChat }: { onOpenChat?: (complaint: WaComplaint) => void }) {
  const [status, setStatus] = useState<WaComplaintStatus | "">("");
  const [severity, setSeverity] = useState<"normal" | "high" | "">("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const query = useApi(
    () =>
      whatsappApi.complaints({
        status: status || undefined,
        severity: severity || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [status, severity, page],
  );

  const data = query.data;
  const items = data?.items ?? [];
  const stats = data?.stats;
  const breached = stats?.breached ?? 0;

  async function changeStatus(complaint: WaComplaint, next: WaComplaintStatus) {
    setUpdatingId(complaint.id);
    try {
      await whatsappApi.updateComplaint(complaint.id, { status: next });
      toast.success(`Complaint moved to ${next.replace("_", " ")}`);
      await query.reload();
    } catch (err) {
      toastError(err);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {stats ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ComplaintStat label="Open" value={stats.open} tone="text-danger" />
          <ComplaintStat label="In progress" value={stats.inProgress} tone="text-warning" />
          <ComplaintStat label="High severity" value={stats.high} tone="text-danger" />
          <ComplaintStat label="Resolved" value={stats.resolved} tone="text-success" />
        </div>
      ) : null}

      {breached > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-danger">
              {breached} {breached === 1 ? "complaint is" : "complaints are"} past SLA
            </p>
            <p className="mt-0.5 text-sm text-danger">
              A staff reply is due within 2 hours and resolution within 24 hours of the complaint opening.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter complaints by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as WaComplaintStatus | "");
            setPage(1);
          }}
          className="w-auto min-w-40"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter complaints by severity"
          value={severity}
          onChange={(event) => {
            setSeverity(event.target.value as "normal" | "high" | "");
            setPage(1);
          }}
          className="w-auto min-w-40"
        >
          <option value="">All severities</option>
          <option value="high">High only</option>
          <option value="normal">Normal only</option>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void query.reload()}>
          <RefreshCw className={cn("h-4 w-4", query.loading && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      </div>

      {query.error ? <ErrorPanel error={query.error} onRetry={query.reload} /> : null}
      {!data && query.loading ? <LoadingRows /> : null}

      {data && items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ShieldAlert}
              title="No complaints in this view"
              description="The bot opens a complaint when a customer reports a damaged item, a wrong product, a refund, a safety concern or a delivery failure."
            />
          </CardContent>
        </Card>
      ) : null}

      {items.length ? (
        <div className="space-y-3">
          {items.map((complaint) => {
            const sla = complaintSla(complaint);
            return (
              <Card key={complaint.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={complaint.severity === "high" ? "danger" : "outline"}>
                      {complaint.severity === "high" ? "High" : "Normal"}
                    </Badge>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {categoryLabel(complaint.category)}
                      {complaint.orderRef ? ` · ${complaint.orderRef}` : ""}
                    </span>
                    <span className="ml-auto" title={sla.hint}>
                      <Badge variant={sla.tone}>{sla.label}</Badge>
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm">{complaint.summary}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{complaint.name || complaint.phone || complaint.waId}</span>
                    <span>Opened {complaint.createdAt ? formatDateTime(complaint.createdAt) : "—"}</span>
                    {onOpenChat ? (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onOpenChat(complaint)}>
                        View chat
                      </Button>
                    ) : null}
                    <Select
                      aria-label={`Change status for ${complaint.name || complaint.waId}`}
                      value={complaint.status}
                      disabled={updatingId === complaint.id}
                      onChange={(event) => void changeStatus(complaint, event.target.value as WaComplaintStatus)}
                      className="ml-auto h-9 w-auto text-xs"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {data ? <Pager page={page} limit={PAGE_SIZE} total={data.total} onPage={setPage} /> : null}
    </div>
  );
}
