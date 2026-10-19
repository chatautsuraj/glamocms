/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, run outside the app */
/**
 * Visual review harness — NOT part of the app or the test suite.
 *
 * Signs a fake staff user into a running dev server (seeded Firebase
 * persistence + mocked identitytoolkit) and answers every /api/v1/pos/* call
 * from fixtures, so each screen can be screenshotted at 360 / 768 / 1440 px
 * without credentials or the live API. Catalog rows come from a snapshot of
 * the public storefront catalog (catalog.fixture.json); orders, customers and
 * analytics are illustrative review data only.
 *
 *   npm run dev   # in apps/web
 *   NODE_PATH=<dir with playwright> node tests/visual/review.cjs [outDir] [route,...]
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = process.env.REVIEW_BASE || "http://localhost:3000";
const OUT = process.argv[2] || "/tmp/pos-shots";
const ONLY = process.argv[3] ? process.argv[3].split(",") : null;
const WIDTHS = (process.env.REVIEW_WIDTHS || "360,768,1440").split(",").map(Number);
const THEME = process.env.REVIEW_THEME || "light";
const API_KEY = "AIzaSyA13D6Q461WTxyWCN8-Qtv53rtvyH0quMw";

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.fixture.json"), "utf8"));
const now = new Date();
const iso = (minsAgo) => new Date(now.getTime() - minsAgo * 60_000).toISOString();

const store = {
  name: "GLAMO Nepal",
  legalName: "GLAMO Nepal Pvt. Ltd.",
  address: "Kathmandu, Nepal",
  phone: "+977 981-8212188",
  email: "info@glamonepal.com",
  pan: "",
  vatNumber: "",
  logoUrl: "",
};
const payments = {
  cash: { enabled: true },
  fonepay: { enabled: true, merchantName: "GLAMO Nepal", terminalId: "", qrImageUrl: "" },
  esewa: { enabled: true, accountName: "GLAMO Nepal", accountId: "9818212188", qrImageUrl: "" },
  khalti: { enabled: true, accountName: "GLAMO Nepal", accountId: "9818212188", qrImageUrl: "" },
  card: { enabled: false },
  bank: { enabled: false, bankName: "", accountName: "", accountNumber: "", branch: "", qrImageUrl: "" },
};
const labels = { size: "38x25", showPrice: true, showName: true };
const posConfig = {
  vatEnabled: true, vatRate: 13, receiptFooter: "Thank you for shopping with GLAMO Nepal.", billPrefix: "GLM",
  maxCashierDiscountPct: 10, allowNegativeStock: false, requireCustomerForCounter: false, taxInvoice: false,
  payments, labels, store,
};
const ALL_PERMS = [
  "pos.sell", "pos.till", "pos.override", "orders.read.own", "orders.read.all", "orders.write", "customers.write", "catalog.write",
  "inventory.write", "analytics.read", "reports.read", "delivery.manage", "whatsapp.inbox", "settings.read", "settings.write",
  "staff.manage", "whatsapp.broadcast",
];
const session = {
  user: { id: "u-review", email: "review@glamonepal.com", name: "Sita Sharma", role: "OWNER", photoUrl: null },
  permissions: ALL_PERMS, store, posConfig,
};

const customers = [
  ["Aashma Shrestha", "9841234567"], ["Pratiksha Gurung", "9803456789"], ["Rojina Thapa", "9812345670"],
  ["Sneha Maharjan", "9860011223"], ["Anusha Rai", "9818899001"], ["Kritika Bhandari", "9845566778"],
].map(([name, phone], i) => ({
  id: `c-${i}`, name, phone, email: null, address: "Lalitpur", marketingConsent: i % 2 === 0, createdAt: iso(60 * 24 * (i + 3)),
  orders: 6 - i, totalSpent: (6 - i) * 2850, lastOrderAt: iso(60 * (i + 2)),
}));

const STATUSES = ["DELIVERED", "PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "OUT_FOR_DELIVERY"];
const CHANNELS = ["POS_COUNTER", "WEBSITE", "WHATSAPP", "PHONE", "POS_COUNTER", "WEBSITE", "POS_COUNTER", "WEBSITE"];
const orders = Array.from({ length: 14 }, (_, i) => {
  const items = catalog.slice(i, i + 1 + (i % 3)).map((p, j) => ({
    id: `oi-${i}-${j}`, productId: p.id, variantId: null, name: p.name, variantName: null, sku: p.sku, quantity: 1 + (j % 2),
    unitPrice: p.price, lineDiscount: 0, lineTotal: p.price * (1 + (j % 2)), imageUrl: p.imageUrl,
  }));
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const channel = CHANNELS[i % CHANNELS.length];
  const shipping = channel === "POS_COUNTER" ? 0 : 150;
  const c = customers[i % customers.length];
  return {
    id: `o-${i}`, orderNumber: `GLM-${2410 + i}`, printableRef: `GLM-${2410 + i}`, channel, status: STATUSES[i % STATUSES.length],
    paymentStatus: i % 4 === 1 ? "PENDING" : "PAID", paymentMethod: ["CASH", "ESEWA", "KHALTI", "FONEPAY_QR"][i % 4],
    customer: { id: c.id, name: c.name, phone: c.phone, email: null }, cashier: { id: "u-review", name: "Sita Sharma" }, shiftId: null,
    items, subtotal, discountAmount: 0, shippingCharge: shipping, vatAmount: Math.round((subtotal * 13) / 113), totalAmount: subtotal + shipping,
    refundedAmount: 0,
    payments: [{ id: `pay-${i}`, kind: "PAYMENT", method: "CASH", amount: subtotal + shipping, tendered: null, reference: null, shiftId: null, createdAt: iso(i * 47) }],
    shipment: null,
    shippingAddress: channel === "POS_COUNTER" ? {} : { fullName: c.name, phone: c.phone, address1: "Jhamsikhel, Ward 3", city: "Lalitpur" },
    notes: null, cancelReason: null,
    timeline: [{ status: "PENDING", note: null, by: "Sita Sharma", at: iso(i * 47 + 30) }],
    createdAt: iso(i * 47), updatedAt: iso(i * 40),
  };
});

const series = [];
for (let d = 6; d >= 0; d--) {
  const date = new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10);
  [["POS_COUNTER", 18500], ["WEBSITE", 12400], ["WHATSAPP", 4200], ["PHONE", 1800]].forEach(([channel, base], k) =>
    series.push({ date, channel, revenue: base + ((d * 1371 + k * 977) % 6000), orders: 4 + ((d + k) % 6) }));
}
const summary = {
  totals: { revenue: 248650, netRevenue: 239200, orders: 112, aov: 2220, items: 196, grossMargin: 86400, refunds: 2400, vat: 28605, discounts: 3900 },
  byChannel: [
    { channel: "POS_COUNTER", revenue: 128400, orders: 61, aov: 2105, items: 104 },
    { channel: "WEBSITE", revenue: 84250, orders: 33, aov: 2553, items: 58 },
    { channel: "WHATSAPP", revenue: 26400, orders: 12, aov: 2200, items: 24 },
    { channel: "PHONE", revenue: 9600, orders: 6, aov: 1600, items: 10 },
  ],
  series,
};
const breakdown = catalog.slice(0, 8).map((p, i) => ({ key: p.id, label: p.name, revenue: p.price * (12 - i), orders: 12 - i, items: 14 - i, margin: null }));

const settings = {
  store,
  pos: { vatEnabled: true, vatRate: 13, receiptFooter: posConfig.receiptFooter, allowNegativeStock: false, maxCashierDiscountPct: 10, billPrefix: "GLM", requireCustomerForCounter: false },
  payments, labels,
  delivery: { ncmEnabled: true, ncmPickupBranch: "TINKUNE", ncmEnv: "prod", defaultDeliveryType: "Door2Door" },
  whatsapp: { enabled: true, phoneNumberDisplay: "+977 981-8212188", autoReplyEnabled: true, aiReplyEnabled: false },
};

function paged(items, url) {
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 20);
  return { success: true, data: items.slice((page - 1) * limit, page * limit), meta: { page, limit, total: items.length } };
}

function route(method, url) {
  const p = url.pathname.replace(/^\/api\/v1/, "");
  const ok = (data, extra) => ({ success: true, data, ...extra });
  if (p === "/pos/session") return ok(session);
  if (p === "/pos/config") return ok(posConfig);
  if (p === "/pos/catalog") return ok(catalog, { meta: { page: 1, limit: catalog.length, total: catalog.length, serverTime: now.toISOString() } });
  if (p === "/pos/products") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const low = url.searchParams.get("lowStock") === "true";
    return paged(catalog.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!low || c.stock <= c.lowStockThreshold)), url);
  }
  if (p.startsWith("/pos/products/")) return ok(catalog.find((c) => c.id === p.split("/")[3]) || catalog[0]);
  if (p === "/pos/lookup") return ok(catalog.find((c) => c.barcode === url.searchParams.get("code")) || null);
  if (p === "/pos/orders") {
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
    return paged(orders.filter((o) => (!status || status.split(",").includes(o.status)) && (!channel || o.channel === channel)), url);
  }
  if (p.match(/^\/pos\/orders\/[^/]+$/)) return ok(orders.find((o) => o.id === p.split("/")[3]) || orders[0]);
  if (p.endsWith("/shipment")) return ok(null);
  if (p === "/pos/customers") return paged(customers, url);
  if (p === "/pos/customers/stats") return ok({ total: 1284, repeat: 412, newCustomers: 38, marketing: 655 });
  if (p.startsWith("/pos/customers/")) {
    const c = customers.find((x) => x.id === p.split("/")[3]) || customers[0];
    return ok({ ...c, stats: { orders: c.orders, totalSpent: c.totalSpent, aov: 2850, lastOrderAt: c.lastOrderAt }, recentOrders: orders.slice(0, 4) });
  }
  if (p === "/pos/analytics/summary") return ok(summary);
  if (p === "/pos/analytics/breakdown") return ok(breakdown);
  if (p.startsWith("/pos/reports/")) {
    return ok({ type: p.split("/")[3], range: { from: iso(10080), to: iso(0) }, columns: ["date", "orders", "revenue"],
      rows: series.filter((s) => s.channel === "POS_COUNTER").map((s) => ({ date: s.date, orders: s.orders, revenue: s.revenue })) });
  }
  if (p === "/pos/settings") return ok(settings);
  if (p === "/pos/staff") return ok([{ ...session.user, isActive: true }, { id: "u-2", email: "counter@glamonepal.com", name: "Counter 1", role: "CASHIER", isActive: true, photoUrl: null }]);
  if (p === "/pos/till/current") return ok(null);
  if (p === "/pos/inventory/movements") {
    return paged(catalog.slice(0, 10).map((c, i) => ({ id: `m-${i}`, productId: c.id, productName: c.name, variantId: null, variantName: null, type: i % 2 ? "SALE" : "RECEIVE", delta: i % 2 ? -1 : 6, previousStock: c.stock, newStock: c.stock + (i % 2 ? -1 : 6), reason: i % 2 ? null : "Supplier delivery", performedBy: "u-review", performedByName: "Sita Sharma", createdAt: iso(i * 90) })), url);
  }
  if (p === "/pos/sync/conflicts") return paged([], url);
  if (p === "/pos/categories") return ok([...new Set(catalog.map((c) => c.category))].map((name, i) => ({ id: `cat-${i}`, name, slug: name.toLowerCase(), parentId: null, description: null, imageUrl: null, sortOrder: i, isActive: true })));
  if (p === "/pos/brands") return ok([...new Set(catalog.map((c) => c.brand))].map((name, i) => ({ id: `b-${i}`, name, slug: String(name).toLowerCase(), description: null, logoUrl: null, website: null, isActive: true, productCount: catalog.filter((c) => c.brand === name).length })));
  if (p === "/pos/delivery/branches") return ok([{ name: "TINKUNE", code: "TINKUNE", district: "Kathmandu", phone: null }, { name: "POKHARA", code: "POKHARA", district: "Kaski", phone: null }]);
  if (p === "/pos/delivery/rate") return ok({ creation: "TINKUNE", destination: url.searchParams.get("destination"), type: "Door2Door", charge: 150 });
  if (p === "/pos/whatsapp/conversations") {
    return paged(customers.slice(0, 4).map((c, i) => ({ waId: `977${c.phone}`, phone: c.phone, name: c.name, lastMessage: ["Is the COSRX snail essence in stock?", "Can you deliver to Pokhara?", "Thank you!", "What's the price of the Beauty of Joseon sunscreen?"][i], lastAt: iso(i * 30 + 5), unread: i === 0 ? 2 : 0, handoff: i === 1, windowOpen: i < 3 })), url);
  }
  if (p.startsWith("/pos/whatsapp/conversations/")) {
    return ok({ waId: p.split("/")[4], phone: customers[0].phone, name: customers[0].name, userId: null, state: "open", handoff: false, windowOpen: true, lastInboundAt: iso(5),
      messages: [{ id: "w1", waMessageId: null, direction: "in", type: "text", body: "Is the COSRX snail essence in stock?", mediaUrl: null, orderId: null, handledBy: null, status: null, createdAt: iso(6) }] });
  }
  if (p === "/pos/campaigns") return ok([]);
  if (p === "/pos/campaigns/audience") return ok({ customers: 655, subscribers: 210, all: 812 });
  if (p === "/pos/sales" && method === "POST") {
    const bill = {
      printableRef: "GLM-2424", createdAt: iso(0), cashierName: "Sita Sharma", customer: { name: "Walk-in", phone: null },
      items: [{ name: catalog[2].name, sku: catalog[2].sku, qty: 1, unitPrice: catalog[2].price, lineDiscount: 0, vatApplicable: true, lineTotal: catalog[2].price }],
      subtotal: 6280, discount: 0, deliveryCharge: 0, taxableAmount: 5558, vatRate: 13, vatAmount: 722, vatEnabled: true, taxInvoice: false,
      total: 6280, payments: [{ method: "CASH", amount: 6280, reference: null }], tendered: 7000, change: 720, due: 0, footer: posConfig.receiptFooter, store,
    };
    return ok({ order: orders[0], bill, duplicate: false });
  }
  if (method !== "GET") return ok({});
  return ok(null);
}

/** Scripted states behind "#step" suffixes: a filled cart, the payment dialog, the shade picker. */
async function runStep(page, step, width) {
  const tiles = page.locator("main button[aria-label*='Rs']");
  if (step === "cart" || step === "pay") {
    for (const i of [2, 4, 4, 6]) await tiles.nth(i).click().catch(() => undefined);
    if (width < 768) await page.getByRole("button", { name: /view sale/ }).click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  if (step === "pay") {
    await page.keyboard.press("F4");
    await page.waitForTimeout(500);
  }
  if (step === "done") {
    for (const i of [2, 4, 4, 6]) await tiles.nth(i).click().catch(() => undefined);
    await page.keyboard.press("F4");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Rs 7,000/ }).click().catch(() => undefined);
    await page.getByRole("button", { name: "Complete sale" }).click().catch(() => undefined);
    await page.waitForTimeout(800);
  }
  if (step === "shade") {
    await page.locator("main button[aria-label*='shades']").first().click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

const PAGES = [
  "/login", "/dashboard", "/pos", "/pos#cart", "/pos#pay", "/pos#shade", "/pos#done", "/orders", "/orders/o-1", "/customers", "/customers/c-0", "/phone", "/products", "/inventory",
  "/delivery", "/whatsapp", "/marketing", "/analytics", "/reports", "/settings",
];

/** Fake signed-in owner + fixture API on a browser context. */
async function setup(context) {
  await context.addInitScript(({ key, signedIn, theme }) => {
    try { localStorage.setItem("theme", theme); } catch {}
    if (!signedIn || location.pathname === "/login") return;
    const user = {
      uid: "u-review", email: "review@glamonepal.com", emailVerified: true, displayName: "Sita Sharma", isAnonymous: false,
      providerData: [], stsTokenManager: { refreshToken: "review", accessToken: "review-token", expirationTime: Date.now() + 36e5 },
      createdAt: "1700000000000", lastLoginAt: "1700000000000", apiKey: key, appName: "[DEFAULT]",
    };
    localStorage.setItem(`firebase:authUser:${key}:[DEFAULT]`, JSON.stringify(user));
  }, { key: API_KEY, signedIn: true, theme: THEME });
  await context.route(/identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/, (r) =>
    r.fulfill({ json: { users: [{ localId: "u-review", email: "review@glamonepal.com", displayName: "Sita Sharma", emailVerified: true }], id_token: "review-token", refresh_token: "review", expires_in: "3600" } }));
  await context.route(/\/api\/v1\//, (r) => {
    const req = r.request();
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204 });
    return r.fulfill({ json: route(req.method(), new URL(req.url())) });
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 780 : width < 1000 ? 1024 : 900 }, colorScheme: THEME, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    await setup(context);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
    for (const p of PAGES.filter((x) => !ONLY || ONLY.includes(x))) {
      errors.length = 0;
      const [pathOnly, step] = p.split("#");
      await page.goto(BASE + pathOnly, { waitUntil: "networkidle" }).catch(() => undefined);
      await page.waitForTimeout(900);
      if (step) await runStep(page, step, width);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const name = `${p === "/" ? "root" : p.slice(1).replace(/[/#]/g, "_")}-${width}${THEME === "dark" ? "-dark" : ""}.png`;
      await page.screenshot({ path: path.join(OUT, name), fullPage: true });
      report.push({ page: p, width, overflow, errors: [...errors] });
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  for (const r of report) if (r.overflow > 0 || r.errors.length) console.log(r.page, r.width, `overflow=${r.overflow}`, r.errors.join(" | "));
  console.log(`shots → ${OUT}`);
}

module.exports = { setup, runStep, BASE };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
