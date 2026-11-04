import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SLA_FIRST_REPLY_MINUTES,
  SLA_RESOLUTION_MINUTES,
  buildWhatsAppDigest,
  complaintSla,
  formatSlaDuration,
  parseDbTime,
} from "../src/lib/whatsapp-digest";
import type { WaConversionAnalytics } from "../src/lib/api/types";

const NOW = Date.parse("2026-11-04T03:00:00Z");

function analytics(
  overrides: Partial<Pick<WaConversionAnalytics, "series" | "funnel" | "topIntents">> = {},
): Pick<WaConversionAnalytics, "series" | "funnel" | "topIntents"> {
  return {
    funnel: {
      conversations: 9,
      engaged: 5,
      newConversations: 7,
      orderStarts: 3,
      orders: 4,
      cancelled: 1,
      netOrders: 3,
      handoffs: 2,
      complaints: 1,
      openComplaints: 1,
      highSeverityComplaints: 1,
      aiReplies: 6,
      offTopic: 0,
      revenue: 4200,
      paidRevenue: 3000,
      averageOrderValue: 1400,
      conversionRate: 0.33,
      engagedConversionRate: 0.6,
      handoffRate: 0.22,
      orderStartRate: 0.6,
    },
    series: [{ date: "2026-11-03", conversations: 4, orders: 2, revenue: 1500 }],
    topIntents: [
      { intent: "pricing", count: 3 },
      { intent: "order_status", count: 2 },
      { intent: "product_search", count: 2 },
      { intent: "complaint", count: 1 },
    ],
    ...overrides,
  };
}

test("SLA targets mirror the two-hour reply and 24-hour resolution lanes", () => {
  assert.equal(SLA_FIRST_REPLY_MINUTES, 120);
  assert.equal(SLA_RESOLUTION_MINUTES, 1440);
});

test("SLA durations read as minutes, hours and days", () => {
  assert.equal(formatSlaDuration(0), "0m");
  assert.equal(formatSlaDuration(45), "45m");
  assert.equal(formatSlaDuration(60), "1h");
  assert.equal(formatSlaDuration(135), "2h 15m");
  assert.equal(formatSlaDuration(1440), "1d");
  assert.equal(formatSlaDuration(1500), "1d 1h");
  assert.equal(formatSlaDuration(-5), "0m");
});

test("SQLite timestamps without a zone are read as UTC", () => {
  assert.equal(parseDbTime("2026-11-04 04:00:00")?.toISOString(), "2026-11-04T04:00:00.000Z");
  assert.equal(parseDbTime("2026-11-04T04:00:00Z")?.toISOString(), "2026-11-04T04:00:00.000Z");
  assert.equal(parseDbTime(null), null);
});

test("an unanswered complaint past two hours shows the reply overrun", () => {
  const sla = complaintSla(
    { status: "open", createdAt: new Date(NOW - 3 * 3_600_000).toISOString(), firstReplyAt: null },
    NOW,
  );
  assert.equal(sla.tone, "danger");
  assert.equal(sla.label, "Reply 1h late");
});

test("an unanswered complaint inside two hours shows the time left", () => {
  const sla = complaintSla(
    { status: "open", createdAt: new Date(NOW - 30 * 60_000).toISOString(), firstReplyAt: null },
    NOW,
  );
  assert.equal(sla.tone, "warning");
  assert.equal(sla.label, "Reply due in 1h 30m");
});

test("a replied complaint inside 24 hours shows the resolution window left", () => {
  const sla = complaintSla(
    {
      status: "in_progress",
      createdAt: new Date(NOW - 5 * 3_600_000).toISOString(),
      firstReplyAt: new Date(NOW - 4 * 3_600_000).toISOString(),
    },
    NOW,
  );
  assert.equal(sla.tone, "success");
  assert.equal(sla.label, "Resolve in 19h");
});

test("an unresolved complaint past 24 hours shows the resolution overrun", () => {
  const sla = complaintSla(
    {
      status: "open",
      createdAt: new Date(NOW - 30 * 3_600_000).toISOString(),
      firstReplyAt: new Date(NOW - 29 * 3_600_000).toISOString(),
    },
    NOW,
  );
  assert.equal(sla.tone, "danger");
  assert.equal(sla.label, "Resolution 6h late");
});

test("a resolved complaint reports how fast staff answered it", () => {
  const sla = complaintSla(
    {
      status: "resolved",
      createdAt: new Date(NOW - 2 * 3_600_000).toISOString(),
      firstReplyAt: new Date(NOW - 2 * 3_600_000 + 10 * 60_000).toISOString(),
    },
    NOW,
  );
  assert.equal(sla.tone, "success");
  assert.equal(sla.label, "Answered in 10m");
});

test("a resolved complaint with no staff reply is called out instead of shown as fast", () => {
  const sla = complaintSla(
    { status: "closed", createdAt: new Date(NOW - 2 * 3_600_000).toISOString(), firstReplyAt: null },
    NOW,
  );
  assert.equal(sla.tone, "muted");
  assert.equal(sla.label, "No reply logged");
});

test("a complaint without a usable timestamp is reported as unknown", () => {
  const sla = complaintSla({ status: "open", createdAt: null, firstReplyAt: null }, NOW);
  assert.equal(sla.tone, "muted");
  assert.equal(sla.label, "No timestamp");
});

test("the digest selects yesterday on the Nepal calendar", () => {
  const digest = buildWhatsAppDigest(analytics(), NOW);
  assert.equal(digest.dateKey, "2026-11-03");
  assert.equal(digest.dateLabel, "Tue 03 Nov");
  assert.equal(digest.point?.conversations, 4);
  assert.equal(digest.point?.revenue, 1500);
  assert.equal(digest.handoffs, 2);
  assert.equal(digest.openComplaints, 1);
  assert.equal(digest.highSeverityComplaints, 1);
  assert.equal(digest.topIntents.length, 3);
  assert.equal(digest.hasActivity, true);
});

test("the digest rolls over at Nepal midnight, not UTC midnight", () => {
  const beforeMidnight = Date.parse("2026-11-03T18:10:00Z");
  const afterMidnight = Date.parse("2026-11-03T18:20:00Z");
  assert.equal(buildWhatsAppDigest(analytics(), beforeMidnight).dateKey, "2026-11-02");
  assert.equal(buildWhatsAppDigest(analytics(), afterMidnight).dateKey, "2026-11-03");
});

test("a missing series day reports no activity instead of fabricated zeros", () => {
  const digest = buildWhatsAppDigest(analytics({ series: [] }), NOW);
  assert.equal(digest.point, null);
  assert.equal(digest.hasActivity, false);
});
