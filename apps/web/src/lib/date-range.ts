/** Shared date-range presets for sales / orders / delivery lists. */

export type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

export type DateRange = { start: Date; end: Date } | null;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Week starts Monday (common for Nepal retail ops). */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d: Date) {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

function endOfMonth(d: Date) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function resolveDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): DateRange {
  if (preset === "all") return null;

  if (preset === "custom") {
    if (!customFrom && !customTo) return null;
    const start = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(new Date(0));
    const end = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }

  if (preset === "today") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }

  if (preset === "this_week") {
    return { start: startOfWeek(now), end: endOfDay(now) };
  }

  if (preset === "last_week") {
    const thisWeekStart = startOfWeek(now);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekStart = startOfWeek(lastWeekEnd);
    return { start: lastWeekStart, end: endOfDay(lastWeekEnd) };
  }

  if (preset === "this_month") {
    return { start: startOfMonth(now), end: endOfDay(now) };
  }

  if (preset === "last_month") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    return { start: startOfMonth(prev), end: endOfMonth(prev) };
  }

  return null;
}

export function isInDateRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!range) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export function filterByCreatedAt<T extends { createdAt: string }>(
  items: T[],
  range: DateRange,
): T[] {
  if (!range) return items;
  return items.filter((item) => isInDateRange(item.createdAt, range));
}

export function datePresetLabel(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
): string {
  if (preset === "custom") {
    if (customFrom && customTo) return `${customFrom} → ${customTo}`;
    if (customFrom) return `From ${customFrom}`;
    if (customTo) return `Until ${customTo}`;
    return "Custom range";
  }
  return DATE_PRESET_OPTIONS.find((o) => o.value === preset)?.label ?? preset;
}
