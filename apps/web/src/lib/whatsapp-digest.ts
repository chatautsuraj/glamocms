import type { WaConversionAnalytics, WaConversionSeriesPoint } from "./api/types";
import { STORE_TIME_ZONE } from "./format";
import { addDays, kathmanduDay } from "./pos/math";

/** First human reply target, mirroring the WhatsApp SLA triage lane. */
export const SLA_FIRST_REPLY_MINUTES = 120;
/** Resolution target, mirroring the WhatsApp SLA triage lane. */
export const SLA_RESOLUTION_MINUTES = 1440;

const DAY_MS = 86_400_000;

export type SlaTone = "success" | "warning" | "danger" | "muted";

export interface ComplaintSlaInput {
  status: string;
  createdAt: string | null;
  firstReplyAt: string | null;
}

export interface ComplaintSla {
  tone: SlaTone;
  label: string;
  hint: string;
}

/** SQLite stores UTC without a suffix; ISO strings already carry one. */
export function parseDbTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSlaDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours < 24) return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  return remainderHours ? `${days}d ${remainderHours}h` : `${days}d`;
}

export function complaintSla(complaint: ComplaintSlaInput, now = Date.now()): ComplaintSla {
  const created = parseDbTime(complaint.createdAt);
  if (!created) {
    return { tone: "muted", label: "No timestamp", hint: "The complaint has no usable creation time." };
  }

  const ageMinutes = Math.max(0, (now - created.getTime()) / 60_000);

  if (complaint.status === "resolved" || complaint.status === "closed") {
    const replied = parseDbTime(complaint.firstReplyAt);
    if (!replied) {
      return { tone: "muted", label: "No reply logged", hint: "Closed without a staff reply on record." };
    }
    const replyMinutes = Math.max(0, (replied.getTime() - created.getTime()) / 60_000);
    return {
      tone: "success",
      label: `Answered in ${formatSlaDuration(replyMinutes)}`,
      hint: "Time from the complaint opening to the first staff reply.",
    };
  }

  if (ageMinutes >= SLA_RESOLUTION_MINUTES) {
    return {
      tone: "danger",
      label: `Resolution ${formatSlaDuration(ageMinutes - SLA_RESOLUTION_MINUTES)} late`,
      hint: "The 24-hour resolution target has passed.",
    };
  }

  if (!complaint.firstReplyAt) {
    if (ageMinutes >= SLA_FIRST_REPLY_MINUTES) {
      return {
        tone: "danger",
        label: `Reply ${formatSlaDuration(ageMinutes - SLA_FIRST_REPLY_MINUTES)} late`,
        hint: "No staff reply yet; the 2-hour first-reply target has passed.",
      };
    }
    return {
      tone: "warning",
      label: `Reply due in ${formatSlaDuration(SLA_FIRST_REPLY_MINUTES - ageMinutes)}`,
      hint: "A staff reply is due within 2 hours of the complaint opening.",
    };
  }

  return {
    tone: "success",
    label: `Resolve in ${formatSlaDuration(SLA_RESOLUTION_MINUTES - ageMinutes)}`,
    hint: "Replied; the 24-hour resolution target is still ahead.",
  };
}

export interface WhatsAppDigest {
  dateKey: string;
  dateLabel: string;
  point: WaConversionSeriesPoint | null;
  handoffs: number;
  openComplaints: number;
  highSeverityComplaints: number;
  topIntents: Array<{ intent: string; count: number }>;
  hasActivity: boolean;
}

export function buildWhatsAppDigest(
  analytics: Pick<WaConversionAnalytics, "series" | "funnel" | "topIntents">,
  now = Date.now(),
): WhatsAppDigest {
  const dateKey = addDays(kathmanduDay(new Date(now)), -1);
  const yesterday = new Date(now - DAY_MS);
  const point = analytics.series.find((entry) => entry.date === dateKey) ?? null;
  return {
    dateKey,
    dateLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: STORE_TIME_ZONE,
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(yesterday),
    point,
    handoffs: analytics.funnel.handoffs,
    openComplaints: analytics.funnel.openComplaints,
    highSeverityComplaints: analytics.funnel.highSeverityComplaints,
    topIntents: analytics.topIntents.slice(0, 3),
    hasActivity: point !== null,
  };
}
