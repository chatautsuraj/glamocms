import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PosDatabase, db, setDb } from "../src/lib/offline/db";
import { refreshCatalog, findCachedByCode } from "../src/lib/offline/catalog-cache";
import { SYNC_BATCH_SIZE, backoffMs, queueSale, queueCounts, syncPending, retryNow } from "../src/lib/offline/queue";
import { ApiError } from "../src/lib/api/errors";
import type { BillData, PosProduct, SalePayload, SyncResult } from "../src/lib/api/types";

let n = 0;
beforeEach(() => setDb(new PosDatabase(`glamo-pos-test-${++n}`)));

const product = (id: string, stock: number, extra: Partial<PosProduct> = {}): PosProduct => ({
  id, sku: `SKU-${id}`, barcode: `890${id}`, name: `Product ${id}`, brand: null, category: null, price: 500, basePrice: 500, salePrice: null,
  mrp: 550, vatApplicable: true, posVisible: true, stock, lowStockThreshold: 2, imageUrl: null, isActive: true, attributes: {}, variants: [], updatedAt: null, ...extra,
});

const bill = (total: number) => ({
  createdAt: new Date().toISOString(), cashierName: "Asha", customer: { name: "Walk-in", phone: null }, items: [], subtotal: total, discount: 0,
  deliveryCharge: 0, taxableAmount: 0, vatRate: 13, vatAmount: 0, total, payments: [], tendered: total, change: 0, due: 0, footer: "",
  store: { name: "GLAMO Nepal", legalName: "", address: "", phone: "", email: "", pan: "", vatNumber: "", logoUrl: "" },
}) as Omit<BillData, "printableRef">;

const sale = (ref: string, productId = "1", quantity = 1): SalePayload => ({
  clientRef: ref, items: [{ productId, quantity }], payments: [{ method: "CASH", amount: 500 * quantity }],
});

async function seed(products: PosProduct[]) {
  await refreshCatalog({ full: true, snapshot: async () => ({ products, serverTime: "2026-10-18T00:00:00.000Z" }) });
}

test("catalog: full snapshot, then delta with updatedSince=serverTime and deleted:true", async () => {
  await seed([product("1", 5), product("2", 3, { variants: [{ id: "v1", name: "Shade 01", sku: "SH-01", barcode: "777001", price: 450, stock: 3 }] })]);
  assert.equal(await db().products.count(), 2);
  assert.equal((await findCachedByCode("777001"))?.variantId, "v1", "variant barcode lookup");
  assert.equal((await findCachedByCode("sku-1"))?.product.id, "1", "case-insensitive SKU lookup");
  let since: string | undefined;
  await refreshCatalog({
    snapshot: async (s) => {
      since = s;
      return { products: [{ ...product("1", 0), deleted: true }, product("3", 9)], serverTime: "2026-10-18T01:00:00.000Z" };
    },
  });
  assert.equal(since, "2026-10-18T00:00:00.000Z");
  assert.deepEqual((await db().products.toArray()).map((p) => p.id).sort(), ["2", "3"]);
});

test("queueSale decrements local stock and issues sequential OFF-<device>-<seq> refs", async () => {
  await seed([product("1", 5)]);
  const a = await queueSale(sale("aaaaaaaa-0001", "1", 2), bill(1000));
  const b = await queueSale(sale("aaaaaaaa-0002", "1", 1), bill(500));
  assert.match(a.provisionalRef, /^OFF-[A-Z0-9]{4}-0001$/);
  assert.equal(b.provisionalRef.slice(-4), "0002");
  assert.equal(a.provisionalRef.slice(0, 8), b.provisionalRef.slice(0, 8), "same device id");
  assert.equal(a.bill.printableRef, a.provisionalRef);
  assert.equal((await db().products.get("1"))?.stock, 2);
  assert.equal((await queueCounts()).pending, 2);
  // a full catalog refresh re-applies still-queued sales to server stock
  await seed([product("1", 5)]);
  assert.equal((await db().products.get("1"))?.stock, 2);
});

test("sync: created/duplicate done, conflict kept for reconciliation, error retried with backoff", async () => {
  await seed([product("1", 5)]);
  for (const ref of ["ref-created-1", "ref-dupe-0002", "ref-conflict-3", "ref-error-0004"]) await queueSale(sale(ref), bill(500));
  const now = 1_000_000;
  const outcome = await syncPending({
    now: () => now,
    send: async (sales) => ({
      results: sales.map((s): SyncResult => {
        if (s.clientRef.includes("created")) return { clientRef: s.clientRef, status: "created", orderId: "o1", printableRef: "GLM-261018-0001" };
        if (s.clientRef.includes("dupe")) return { clientRef: s.clientRef, status: "duplicate", orderId: "o2" };
        if (s.clientRef.includes("conflict")) return { clientRef: s.clientRef, status: "conflict", orderId: "o3", conflicts: [{ productId: "1", requested: 1, available: 0 }] };
        return { clientRef: s.clientRef, status: "error", reason: "createdAt too old" };
      }),
    }),
  });
  assert.deepEqual({ ...outcome }, { sent: 4, created: 1, duplicate: 1, conflict: 1, error: 1, networkFailure: false });
  const pending = await db().pendingSales.toArray();
  assert.deepEqual(pending.map((p) => p.clientRef), ["ref-error-0004"]);
  assert.equal(pending[0].needsAttention, true);
  assert.equal(pending[0].lastError, "createdAt too old");
  assert.equal(pending[0].nextAttemptAt, now + backoffMs(1));
  const conflict = await db().syncResults.get("ref-conflict-3");
  assert.equal(conflict?.status, "conflict");
  assert.equal(conflict?.acknowledged, false, "conflicts are never dropped");
  assert.equal((await queueCounts()).conflicts, 1);
  assert.equal((await db().syncResults.get("ref-created-1"))?.printableRef, "GLM-261018-0001");

  // not due yet → nothing sent
  let calls = 0;
  await syncPending({ now: () => now + 1000, send: async () => { calls++; return { results: [] }; } });
  assert.equal(calls, 0);
  // manager retry makes it due immediately
  await retryNow("ref-error-0004");
  await syncPending({ now: () => now + 1000, send: async (s) => ({ results: s.map((x) => ({ clientRef: x.clientRef, status: "created" as const })) }) });
  assert.equal(await db().pendingSales.count(), 0);
});

test("sync: network failure keeps every sale queued with exponential backoff", async () => {
  await seed([product("1", 5)]);
  await queueSale(sale("net-fail-0001"), bill(500));
  const outcome = await syncPending({ now: () => 0, send: async () => { throw new ApiError("Network request failed", 0, "NETWORK_ERROR"); } });
  assert.equal(outcome.networkFailure, true);
  const row = await db().pendingSales.get("net-fail-0001");
  assert.equal(row?.attempts, 1);
  assert.equal(row?.needsAttention, false);
  assert.equal(row?.nextAttemptAt, backoffMs(1));
  assert.ok(backoffMs(3) > backoffMs(2) && backoffMs(50) === 60 * 60_000);
});

test("sync: batches of at most 50", async () => {
  await seed([product("1", 1000)]);
  for (let i = 0; i < 120; i++) await queueSale(sale(`batch-${String(i).padStart(4, "0")}`), bill(500));
  const sizes: number[] = [];
  await syncPending({ send: async (s) => { sizes.push(s.length); return { results: s.map((x) => ({ clientRef: x.clientRef, status: "created" as const })) }; } });
  assert.deepEqual(sizes, [SYNC_BATCH_SIZE, SYNC_BATCH_SIZE, 20]);
  assert.equal(await db().pendingSales.count(), 0);
});
