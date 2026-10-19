/**
 * Display formatting. Money is whole-rupee NPR with Indian digit grouping
 * (1,23,456); dates/times are always shown in Asia/Kathmandu, whatever the
 * device clock is set to.
 */
export const STORE_TIME_ZONE = "Asia/Kathmandu";

const grouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** No-break space keeps "Rs" and the amount on one line. */
const RS = "Rs\u00a0";

/** "Rs 1,23,456" (negative: "-Rs 500"). `compact` → "Rs 1.2L" / "Rs 12.5K" for charts. */
export function formatNPR(amount: number, compact = false): string {
  const value = Math.round(Number(amount) || 0);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (compact && abs >= 100000) return `${sign}${RS}${(abs / 100000).toFixed(1)}L`;
  if (compact && abs >= 1000) return `${sign}${RS}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${RS}${grouping.format(abs)}`;
}

/** Whole number with Indian grouping. */
export function formatNumber(n: number): string {
  return grouping.format(Math.round(Number(n) || 0));
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

const toDate = (date: string | Date) => (typeof date === "string" ? new Date(date) : date);

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: STORE_TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: STORE_TIME_ZONE });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: STORE_TIME_ZONE });

/** "18 Oct 2026" */
export function formatDate(date: string | Date): string {
  const d = toDate(date);
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d);
}

/** "18 Oct, 12:00 pm" */
export function formatDateTime(date: string | Date): string {
  const d = toDate(date);
  return Number.isNaN(d.getTime()) ? "" : dateTimeFmt.format(d);
}

/** "12:00 pm" */
export function formatTime(date: string | Date): string {
  const d = toDate(date);
  return Number.isNaN(d.getTime()) ? "" : timeFmt.format(d);
}

/** Digits only, as a number (for rupee/quantity inputs). */
export function digitsToInt(value: string): number {
  return Number(value.replace(/\D/g, "")) || 0;
}
