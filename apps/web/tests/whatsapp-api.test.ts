import { test } from "node:test";
import assert from "node:assert/strict";
import { configureApi } from "../src/lib/api/client";
import { whatsappApi } from "../src/lib/api/whatsapp";

type Call = { url: string; init: RequestInit };

function stubFetch(body: unknown): Call[] {
  const calls: Call[] = [];
  configureApi({ getToken: async () => "tok" });
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true, data: body }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test("whatsapp analytics asks for the requested Nepal-calendar day window", async () => {
  const calls = stubFetch({ range: { days: 2, from: "a", to: "b" }, funnel: {}, series: [], topIntents: [], events: [] });
  await whatsappApi.analytics(2);
  assert.equal(calls[0].url, "https://api.glamonepal.com/api/v1/pos/whatsapp/analytics?days=2");
  assert.equal(calls[0].init.method, "GET");
});

test("complaints keep the server stats alongside the page of items", async () => {
  const body = {
    items: [{ id: "c1", status: "open" }],
    total: 1,
    stats: { open: 1, inProgress: 0, high: 1, resolved: 0, breached: 1 },
  };
  const calls = stubFetch(body);
  const result = await whatsappApi.complaints({ status: "open", page: 1, limit: 30 });
  assert.deepEqual(result, body);
  assert.equal(
    calls[0].url,
    "https://api.glamonepal.com/api/v1/pos/whatsapp/complaints?status=open&page=1&limit=30",
  );
});

test("updating a complaint PATCHes the id and the changed fields", async () => {
  const calls = stubFetch({ id: "c1", status: "resolved" });
  await whatsappApi.updateComplaint("c 1", { status: "resolved", resolutionNote: "Replacement sent" });
  assert.equal(calls[0].url, "https://api.glamonepal.com/api/v1/pos/whatsapp/complaints/c%201");
  assert.equal(calls[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    status: "resolved",
    resolutionNote: "Replacement sent",
  });
});
