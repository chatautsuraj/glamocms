"use client";

import { useEffect } from "react";
import { ArrowRight, RefreshCw, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { friendlyError } from "@/lib/api/errors";
import { whatsappApi } from "@/lib/api/whatsapp";
import { formatNPR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { buildWhatsAppDigest } from "@/lib/whatsapp-digest";

function DigestMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "danger";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-lg font-semibold", tone === "danger" ? "text-danger" : "text-foreground")}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

export function WhatsAppDigestCard({ onOpenComplaints }: { onOpenComplaints?: () => void }) {
  const query = useApi(() => whatsappApi.analytics(2), []);
  const reload = query.reload;

  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 300_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const digest = query.data ? buildWhatsAppDigest(query.data) : null;

  if (!digest) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-5">
          <Sunrise className="h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Yesterday&apos;s digest</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {query.error ? friendlyError(query.error) : "Reading the last 2 days of WhatsApp activity…"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void query.reload()}>
            <RefreshCw className={cn("h-4 w-4", query.loading && "animate-spin")} aria-hidden />
            {query.error ? "Retry" : "Refresh"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <Sunrise className="h-4 w-4 text-warning" aria-hidden />
              Yesterday&apos;s digest
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{digest.dateLabel}</span> · Nepal time · mirrors the 09:00 alert
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Refresh yesterday's digest" onClick={() => void query.reload()}>
            <RefreshCw className={cn("h-4 w-4", query.loading && "animate-spin")} aria-hidden />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <DigestMetric label="Conversations" value={digest.point ? formatNumber(digest.point.conversations) : "—"} note="Unique chats" />
          <DigestMetric label="Orders" value={digest.point ? formatNumber(digest.point.orders) : "—"} note="WhatsApp channel" />
          <DigestMetric label="Revenue" value={digest.point ? formatNPR(digest.point.revenue) : "—"} note="Non-cancelled" />
          <DigestMetric label="Handoffs" value={formatNumber(digest.handoffs)} note="Last 2 days" />
          <DigestMetric
            label="Open complaints"
            value={formatNumber(digest.openComplaints)}
            note={`${formatNumber(digest.highSeverityComplaints)} high severity · last 2 days`}
            tone={digest.highSeverityComplaints > 0 ? "danger" : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Top intents · 2d</span>
          {digest.topIntents.length ? (
            digest.topIntents.map((intent) => (
              <span key={intent.intent} className="whitespace-nowrap capitalize">
                {intent.intent.replace(/_/g, " ")}{" "}
                <span className="tabular font-semibold text-foreground">{formatNumber(intent.count)}</span>
              </span>
            ))
          ) : (
            <span>None recorded</span>
          )}
          {onOpenComplaints ? (
            <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={onOpenComplaints}>
              Review complaints <ArrowRight className="h-3 w-3" aria-hidden />
            </Button>
          ) : null}
        </div>

        {!digest.hasActivity ? (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            No recorded activity for yesterday in the 2-day window.
          </p>
        ) : null}

        {query.error ? (
          <p role="alert" className="text-xs text-danger">
            Could not refresh: {friendlyError(query.error)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
