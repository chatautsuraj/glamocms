# GLAMO POS

Standalone point-of-sale and commerce cockpit for **GLAMO Nepal** (S.S Chowk, Madhyapur Thimi, Bagmati · +977 9818212188).
It is a **pure client** of the GLAMO Nepal Hono API — every screen reads and writes
`${NEXT_PUBLIC_API_URL}/api/v1/pos/*` (prod `https://api.glamonepal.com`). There is no
backend in this repo, no BFF, no database and no demo data. Contract:
`POS-API-CONTRACT.md` (shared with `glamo-nepal/backend`).

- **App:** `apps/web` — Next.js 15 (App Router, client-rendered), React 19, Tailwind 4, Zustand, Dexie, jsPDF, jsbarcode, html5-qrcode, recharts.
- **Auth:** Firebase Google sign-in (same Firebase project as glamonepal.com) → `POST /pos/session` → `{user, permissions, store}`; the Firebase ID token is sent as `Bearer` on every call (forced refresh + retry on 401, sign-out if still 401; 403 → toast).
- **Hosting:** Cloudflare Workers via OpenNext, custom domain `pos.glamonepal.com` — see [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md).

## Run locally

```sh
cd apps/web
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL (e.g. http://localhost:3001 for the local backend)
npm run dev                    # http://localhost:3000
```

Sign in with a Google account whose `users.role` is CASHIER / MANAGER / ADMIN / SUPER_ADMIN / OWNER
(add staff from **Settings → Staff & roles**, or in the backend). The API must allow the POS origin (CORS:
`https://pos.glamonepal.com` is always allowed; add `http://localhost:3000` to `ALLOWED_ORIGINS` for dev).

## Quality gate

```sh
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` runs every `tests/*.test.ts` (node:test via tsx):

| test | covers |
|---|---|
| `print-parity.test.ts` | the bill and delivery note render **byte-identically** to the pre-rewrite layout (fixture `tests/fixtures/print-old.json`, captured from the old code) except the logo and company fields; NCM tracking line on delivery notes |
| `pos-math.test.ts` | VAT-inclusive extraction (13%), pro-rata discounts, per-SKU VAT toggle, split tenders / change / non-cash overpayment / khata, sale payload & offline bill builders, keyboard-wedge scanner detection |
| `offline-queue.test.ts` | Dexie catalog snapshot + `updatedSince` deltas + `deleted:true`, optimistic stock, `OFF-<device>-<seq>` refs, sync batches ≤ 50, created/duplicate/conflict/error handling, backoff |
| `api-client.test.ts` | envelope + meta parsing, `errors[0]` codes → friendly copy, 401 refresh-retry, 403 hook, network errors |
| `permissions.test.ts` | nav / page gating per role |

## Roles

| role | sees |
|---|---|
| CASHIER (and legacy STAFF) | Dashboard (own shift), Till, own-shift Orders, Customer lookup |
| MANAGER / ADMIN | + Phone desk, Products, Inventory, Delivery, WhatsApp inbox, Analytics, Reports, Settings (read-only), price override / discounts over the cashier cap |
| SUPER_ADMIN / OWNER | + Settings edit, Staff & roles, WhatsApp broadcasts |

Unauthenticated users go to `/login`; pages a role may not open show "No access".

## Page → endpoint map

| page | endpoints |
|---|---|
| Login | Firebase `signInWithPopup` → `POST /pos/session` |
| Dashboard | `GET /pos/analytics/summary` (today), `GET /pos/till/current`, `GET /pos/orders`, `GET /pos/products?lowStock=true` |
| Till `/till` | `GET /pos/catalog[?updatedSince]` (IndexedDB cache), `GET /pos/lookup?code=`, `GET /pos/customers?q`, `GET/POST /pos/till/current|open|close`, `POST /pos/sales`, `POST /pos/sales/sync` (offline queue) |
| Orders `/orders`, `/orders/[id]` | `GET /pos/orders`, `GET /pos/orders/:id`, `PATCH /pos/orders/:id/status`, `POST /pos/orders/:id/cancel`, `POST /pos/orders/:id/refund`, shipment endpoints below |
| Phone desk `/phone` | `POST /pos/sales` (channel PHONE / WHATSAPP / MANUAL + `delivery`), `GET /pos/delivery/branches`, `GET /pos/delivery/rate`, `GET /pos/lookup` |
| Products `/products` | `GET/POST /pos/products`, `PATCH/DELETE /pos/products/:id`, `GET /categories`, `GET /brands` |
| Inventory `/inventory` | `GET /pos/products`, `POST /pos/inventory/adjust`, `GET /pos/inventory/movements`, `GET /pos/sync/conflicts`, `POST /pos/sync/conflicts/:id/resolve` (+ local queue review) |
| Customers `/customers`, `/customers/[id]` | `GET/POST /pos/customers`, `GET/PATCH /pos/customers/:id`, `GET/POST /pos/customers/:id/khata` |
| Analytics `/analytics` | `GET /pos/analytics/summary`, `GET /pos/analytics/breakdown?groupBy=product|category|payment|staff|hour` — channel switcher + table view + CSV on every chart |
| Reports `/reports` | `GET /pos/reports/:type?format=json` (table) and `format=csv` (download) for sales / vat / products / till / inventory, with channel switcher |
| Delivery `/delivery` | `GET /pos/orders?status=…`, `PATCH …/status` (PACKED → NCM), `POST /pos/orders/:id/shipment`, `POST …/shipment/refresh`, `GET /pos/delivery/branches`, `GET /pos/delivery/rate` |
| WhatsApp `/whatsapp` | `GET /pos/whatsapp/conversations`, `GET …/:waId`, `POST …/:waId/reply`, `POST …/:waId/resolve`, `POST /pos/whatsapp/broadcasts` |
| Settings `/settings` | `GET/PATCH /pos/settings` (store, pos, delivery, whatsapp), `GET/POST /pos/staff`, `PATCH /pos/staff/:id` |

## Till

- **Scanning:** USB HID scanners (keyboard wedge — fast keystrokes + Enter) are picked up anywhere on the till when focus is not in a text field; the search box also accepts a scan + Enter; the camera button uses html5-qrcode. Lookup = IndexedDB catalog cache (barcode / SKU of product or shade), then `GET /pos/lookup`.
- **Keyboard:** F2 / `/` search · F4 customer · F8 pay · Esc closes dialogs. All controls are ≥ 40 px touch targets with visible focus rings.
- **Tenders:** Cash (tendered → change), Fonepay QR (shows the store QR), Khalti, eSewa, Card, Bank transfer (references required), Khata/credit (needs a named customer). Add several methods to **split**; change is only given in cash (mirrors the server).
- **VAT:** shelf prices are VAT-inclusive; VAT is extracted from the VAT-applicable net (default 13 % from settings, per-SKU toggle). The client mirrors `pos.math.ts` for display; the server recomputes.
- **Till shifts:** open with float; close with a denomination count → expected vs counted variance.
- **Bills** print from the server `BillData` (or the identical local equivalent when offline). The layout is unchanged from the old `print-bill.ts`; only the logo (embedded `public/images/logo.png` data URL), the company block (store settings) and line data (BillData) changed.

## Offline

- `public/sw.js` (production only) caches the app shell and static assets.
- IndexedDB (Dexie, `src/lib/offline`) holds the catalog snapshot (refreshed with `updatedSince=meta.serverTime`, honouring `deleted:true`), `pendingSales` (full `POST /pos/sales` payloads keyed by uuid `clientRef`) and `syncResults`. No business data goes to localStorage.
- Offline sale → queued, local stock decremented, bill printed with provisional `OFF-<device>-<seq>`, banner "Offline — N sales queued". On reconnect and every 30 s: `POST /pos/sales/sync` in batches ≤ 50. `created`/`duplicate` → done; `conflict` → kept in the reconciliation list (Inventory → Sync reconciliation) until acknowledged/resolved; `error` → kept, retried with exponential backoff and surfaced to managers.

## Removed in the GLAMO POS rewrite

- `apps/api/**` (Nest API, Prisma schema/migrations/seed, Dockerfile), `apps/web/src/app/api/commerce/**` (BFF), `docker-compose.yml`, `render.yaml`, `scripts/deploy-vercel.js`, `DEPLOY-VERCEL.md`, `Start Beauty Store.cmd`.
- Demo data: `glamo-catalog.json`, `legacy-cosmetics-catalog.json`, `catalog-fallback.ts`, `catalog-migration.ts`, `mock-data.ts` (demo company/users/credentials), bundled product photos `public/products/glamo/*`, `local-commerce.ts`, the 2 000-line local Zustand store, `commerce-api.ts`, `commerce-client.ts`, `server-api.ts`, `sync-caller.ts`, tenant/entitlement stamping (`_stamp-tenant.js`, `features.ts`, `use-entitlements.ts`, `use-tenant-data.ts`), demo/password login.
- Pages / nav not in v1: sales-team, salesperson, warehouse, purchase, suppliers, expenses, finance, ai, admin (+ admin/clients tenants), notifications, products/pricing, inventory/barcodes (labels now print from Products), sales/all, sales/returns (refunds live on the order), sales/galla (→ `/till`), reports/[slug] (→ `/reports`).
- Stale Nest/Vercel planning docs moved to `docs/archive/`.

## Known gaps

- Cashiers can't read `/pos/settings`, so their till shows VAT at the default 13 % (or the last cached settings) — totals are still server-authoritative.
- Variants (shades) are read-only here; they're edited in the website admin (no POS variant write endpoint).
- Product images are set by URL (no upload endpoint under `/pos`).
- The `receiptFooter` setting is stored but not printed — the bill layout was frozen by the parity requirement.
