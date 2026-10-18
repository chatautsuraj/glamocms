# GLAMO POS

Point of sale and shop back-office for **GLAMO Nepal**. It is a pure client of the GLAMO Nepal Hono API:
every screen reads and writes `${NEXT_PUBLIC_API_URL}/api/v1/pos/*` (production `https://api.glamonepal.com`).
There is no backend or database in this repo. Contract: [docs/POS-API-CONTRACT.md](docs/POS-API-CONTRACT.md)
(shared with `glamo-nepal/backend`).

- **App:** `apps/web` — Next.js 15 (App Router, client-rendered), React 19, Tailwind 4, Zustand, Dexie, jsPDF, jsbarcode, html5-qrcode, recharts.
- **Sign-in:** Firebase Google sign-in (same Firebase project as glamonepal.com) → `POST /pos/session` → `{ user, permissions, store, posConfig }`. No passwords or PINs.
- **Hosting:** Cloudflare Workers via OpenNext at `pos.glamonepal.com` — see [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md).

## Run locally

```sh
cd apps/web
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL (e.g. http://localhost:8787 for the local backend)
npm run dev                    # http://localhost:3000
```

Sign in with a Google account whose role is CASHIER / MANAGER / ADMIN / SUPER_ADMIN / OWNER (add staff in
**Settings → Staff**). The API must allow the POS origin (`https://pos.glamonepal.com` is always allowed; add
`http://localhost:3000` to `ALLOWED_ORIGINS` for development).

## Quality gate

```sh
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` runs every `tests/*.test.ts` (node:test via tsx):

| test | covers |
|---|---|
| `bill.test.ts` | no estimate / "not a tax invoice" / "thank you" wording; VAT off → no VAT line; tax invoice line; Settings footer; Indian digit grouping |
| `print-parity.test.ts` | bill + delivery note keep the original layout byte-for-byte apart from the documented v2 changes (listed at the top of the file) |
| `labels.test.ts` | EAN-13 check digit, EAN-13 vs CODE128 choice, label document (@page size, copies, A4 sheets, show name/price) |
| `scanner.test.ts` | USB scanner burst detection vs typing, scans while typing, stripping the scanned code from the focused input |
| `payments.test.ts` | only payment methods enabled in Settings are offered; account details for the QR screen |
| `customer.test.ts` | Nepali mobile validation (98/97 + 8 digits); phone-order customer validation |
| `pos-math.test.ts` | VAT-inclusive maths, VAT switched off, pro-rata discounts, split payments, change, quick cash amounts, cash drawer wording, cart + sale payload + offline bill |
| `offline-queue.test.ts` | IndexedDB catalog snapshot + deltas, offline sale queue, sync batches, conflicts, back-off |
| `api-client.test.ts` | envelope parsing, error codes → plain messages, validation details, uploads, 401 refresh |
| `permissions.test.ts` | menu / page access per role |

## Roles

| role | sees |
|---|---|
| CASHIER | Dashboard, POS, own sales, customer lookup |
| MANAGER / ADMIN | + Phone & WhatsApp orders, Products, Stock (incl. barcode labels), Delivery, WhatsApp, Analytics, Reports, Settings (view only), price changes and discounts above the cashier limit |
| SUPER_ADMIN / OWNER | + change Settings, Staff, WhatsApp offer messages |

## Screens → API

| screen | endpoints |
|---|---|
| Sign in | Firebase `signInWithPopup` → `POST /pos/session` (includes `posConfig`) |
| POS `/pos` (`/till` redirects here) | `GET /pos/catalog[?updatedSince]` (IndexedDB), `GET /pos/lookup?code=`, `GET /pos/config`, `GET /pos/customers?q`, `POST /pos/sales`, `POST /pos/sales/sync`, optional cash drawer `GET/POST /pos/till/current|open|close` |
| Orders `/orders`, `/orders/[id]` | `GET /pos/orders`, `GET /pos/orders/:id`, `PATCH …/status`, `POST …/cancel`, `POST …/refund`, shipment endpoints |
| Phone & WhatsApp orders `/phone` | `POST /pos/sales` (channel PHONE / WHATSAPP / MANUAL + `delivery`), `GET /pos/customers?q`, `GET /pos/delivery/branches`, `GET /pos/delivery/rate` |
| Products `/products` | `GET/POST /pos/products`, `PATCH/DELETE /pos/products/:id`, `POST /pos/barcodes/next`, photos `POST/PATCH/DELETE /pos/products/:id/images…`, shades `POST/PATCH/DELETE /pos/products/:id/variants…`, `GET/POST/PATCH /pos/categories`, `/pos/brands` |
| Stock `/inventory` | `GET /pos/products`, `POST /pos/inventory/adjust`, `GET /pos/inventory/movements`, `GET /pos/sync/conflicts`, `POST …/resolve`; barcode labels from the IndexedDB catalog |
| Customers | `GET/POST /pos/customers`, `GET/PATCH /pos/customers/:id` |
| Analytics / Reports | `GET /pos/analytics/summary`, `GET /pos/analytics/breakdown`, `GET /pos/reports/:type?format=json|csv` |
| Delivery | `GET /pos/orders?status=…`, `PATCH …/status`, `POST /pos/orders/:id/shipment[/refresh]`, `GET /pos/delivery/branches|rate` |
| WhatsApp | `GET /pos/whatsapp/conversations[/:waId]`, `POST …/reply`, `POST …/resolve`, `POST /pos/whatsapp/broadcasts` |
| Settings | `GET/PATCH /pos/settings` (store, VAT & bills, payments, labels, delivery, WhatsApp), `POST /pos/uploads/image`, `GET/POST /pos/staff`, `PATCH /pos/staff/:id` |

## The counter (POS)

- **Scanning:** USB barcode scanners (keyboard wedge) work anywhere on the screen — even while the search box has focus. A burst of fast keystrokes ending in Enter is a scan; normal typing is not (`lib/pos/scanner.ts`). Each scan beeps and flashes the line; scanning again adds one more. The camera button uses html5-qrcode. Lookup: this device's catalog first, then `GET /pos/lookup`.
- **Keyboard:** F2 search · F4 charge · `+` / `−` change the last item · Esc closes dialogs / clears the search.
- **Payments:** only the methods switched on in Settings → Payments. Cash shows quick amounts (exact, next 100 / 500 / 1000) and the change. Fonepay, eSewa, Khalti and bank transfer open a large customer-facing screen with the shop's QR (or the ID / account number when no QR is uploaded), with a full-screen "Show to customer" mode. Split payments combine methods; change is only given in cash.
- **VAT:** global switch in Settings. On: prices include VAT and the VAT amount is shown and printed. Off: no VAT anywhere. The server always recalculates the bill.
- **Customer:** walk-in by default; "Add customer (phone)" is optional unless the owner requires it in Settings.
- **Cash drawer (optional):** "Cash in drawer when you start" and "Count cash at end of day" show what should be in the drawer and whether it is short or extra. Selling never depends on it.
- **Bills** print through a hidden print frame (no pop-ups) from the server `BillData`, or the identical offline equivalent. No estimate wording; "Tax invoice · PAN …" when VAT is on and a PAN is set; the Settings footer at the bottom.

## Barcodes & labels

Every product and shade has a barcode (the backend issues in-store EAN-13 codes `200…` automatically; "Generate" in the product form reserves one). **Stock → Barcode labels** prints many labels at once (search, category, running-low filter, select all, number of labels per item, default = stock). Each product row also has **Print label**. Label size (38 × 25 mm or 50 × 25 mm roll, or A4 sheet of 65) and whether to print name / price come from **Settings → Barcode labels**; the print document's `@page` matches the label so nothing else prints.

## Offline

- `public/sw.js` (production only) caches the app shell and static assets; the print code is preloaded on the POS screen so bills print offline.
- IndexedDB (Dexie, `src/lib/offline`) holds the catalog snapshot, the selling config (`posConfig`), queued sales (full `POST /pos/sales` payloads keyed by `clientRef`) and sync results.
- Offline sale → saved on the device, stock reduced locally, bill printed with number `OFF-<device>-<seq>`. When the connection returns (and every 30 s): `POST /pos/sales/sync` in batches of up to 50. Problems (rejected sales, stock conflicts) appear under **Stock → Offline sales check**.

## Known limitations

- Queued offline sales are sent with the account of whoever is signed in when the device reconnects, so if staff swap devices while offline the cashier name follows the person who synced.
- Bills embed the bundled GLAMO logo (works offline); the logo uploaded in Settings is used in the app header.
