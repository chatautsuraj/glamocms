import { test } from "node:test";
import assert from "node:assert/strict";
import { api, configureApi, buildUrl, API_BASE } from "../src/lib/api/client";
import { ApiError, friendlyError } from "../src/lib/api/errors";

type Call = { url: string; init: RequestInit };
function stubFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

test("builds /api/v1 URLs and drops empty query params", () => {
  assert.equal(API_BASE, "https://api.glamonepal.com/api/v1");
  assert.equal(buildUrl("/pos/orders", { channel: "PHONE", q: "", page: 2, x: undefined }), "https://api.glamonepal.com/api/v1/pos/orders?channel=PHONE&page=2");
});

test("sends Bearer token and unwraps the envelope + meta", async () => {
  configureApi({ getToken: async () => "tok-1" });
  const calls = stubFetch([{ status: 200, body: { success: true, data: [{ id: "a" }], meta: { page: 1, limit: 20, total: 41 } } }]);
  const res = await api.list<{ id: string }>("/pos/orders", { page: 1 });
  assert.deepEqual(res, { items: [{ id: "a" }], page: 1, limit: 20, total: 41 });
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer tok-1");
});

test("maps errors[0] machine codes to ApiError + friendly copy", async () => {
  stubFetch([{ status: 409, body: { success: false, message: "Open a till first", errors: ["TILL_NOT_OPEN"] } }]);
  await assert.rejects(api.post("/pos/sales", {}), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, "TILL_NOT_OPEN");
    assert.equal(err.status, 409);
    assert.equal(friendlyError(err), "Open the till before taking counter sales.");
    return true;
  });
});

test("401 retries once with a forced token refresh, then reports unauthorized", async () => {
  const forced: boolean[] = [];
  let unauthorized = 0;
  configureApi({ getToken: async (force) => { forced.push(Boolean(force)); return force ? "fresh" : "stale"; }, onUnauthorized: () => unauthorized++ });
  const calls = stubFetch([{ status: 401, body: { success: false } }, { status: 200, body: { success: true, data: { ok: 1 } } }]);
  assert.deepEqual(await api.get("/pos/till/current"), { ok: 1 });
  assert.deepEqual(forced, [false, true]);
  assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer fresh");
  assert.equal(unauthorized, 0);
  stubFetch([{ status: 401, body: { success: false } }, { status: 401, body: { success: false, errors: ["UNAUTHORIZED"] } }]);
  await assert.rejects(api.get("/pos/till/current"));
  assert.equal(unauthorized, 1);
});

test("403 fires the forbidden hook; network failures become NETWORK_ERROR", async () => {
  let forbidden = "";
  configureApi({ getToken: async () => "t", onForbidden: (e) => { forbidden = e.code; } });
  stubFetch([{ status: 403, body: { success: false, message: "nope", errors: ["FORBIDDEN"] } }]);
  await assert.rejects(api.get("/pos/settings"));
  assert.equal(forbidden, "FORBIDDEN");
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  await assert.rejects(api.get("/pos/catalog"), (err: unknown) => err instanceof ApiError && err.isNetwork && err.code === "NETWORK_ERROR");
});
