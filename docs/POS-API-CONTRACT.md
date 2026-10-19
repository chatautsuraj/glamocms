# GLAMO POS ⇄ api.glamonepal.com — API contract (v2)

Single source of truth for the POS frontend (glamocms → GLAMO POS) and the Hono backend (glamo-nepal/backend).
Both sides MUST follow this. If a side needs a change, update this file and say so in the final report.

## Conventions
- Base URL: `${NEXT_PUBLIC_API_URL}/api/v1` (prod `https://api.glamonepal.com/api/v1`, local `http://localhost:8787/api/v1` or whatever backend dev uses).
- Auth: `Authorization: Bearer <Firebase ID token>` (same Firebase project as glamonepal.com, Google sign-in). Bearer requests are not CSRF-checked.
- Envelope (existing backend convention): `{ success: boolean, data?: T, message?: string, errors?: [] , meta?: { page, limit, total } }`.
- Money: integer NPR (whole rupees, same unit as `products.base_price`). VAT rate default 13, configurable in settings.
- All POS endpoints live under `/api/v1/pos/*` so storefront/admin routes are untouched.
- Dates: ISO-8601 UTC strings. Business-day boundaries are Asia/Kathmandu (+05:45) — `from`/`to` query params are `YYYY-MM-DD` in Kathmandu time.

## Roles & permissions
Roles (users.role): `CUSTOMER`, `CASHIER`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`, `OWNER`. Hierarchy OWNER ⊃ SUPER_ADMIN ⊃ ADMIN ⊃ MANAGER ⊃ CASHIER.
ADMIN keeps today's site-admin powers and gets MANAGER POS powers.

| permission | CASHIER | MANAGER/ADMIN | SUPER_ADMIN/OWNER |
|---|---|---|---|
| `pos.sell`, `pos.till` | ✓ | ✓ | ✓ |
| `orders.read.own` (own shift) | ✓ | ✓ | ✓ |
| `orders.read.all`, `orders.write`, `customers.write` | – | ✓ | ✓ |
| `catalog.write`, `inventory.write` | – | ✓ | ✓ |
| `analytics.read`, `reports.read` | – | ✓ | ✓ |
| `delivery.manage`, `whatsapp.inbox` | – | ✓ | ✓ |
| `settings.read` | – | ✓ | ✓ |
| `settings.write`, `staff.manage`, `whatsapp.broadcast` | – | – | ✓ |

## Channels & statuses
- `channel`: `WEBSITE | POS_COUNTER | WHATSAPP | PHONE | MANUAL` (existing orders default `WEBSITE`).
- order `status`: `PENDING | CONFIRMED | PROCESSING | PACKED | SHIPPED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED | RETURNED`.
  Counter sales are created `DELIVERED` with `payment_status=PAID`. Transition to `PACKED` triggers NCM shipment creation (delivery orders only) + WhatsApp notification.
- payment `method` (tender lines): `CASH | FONEPAY_QR | KHALTI | ESEWA | CARD | BANK_TRANSFER`. (v2: `CREDIT`/khata removed — 400 on sales and refunds.) Methods switched off in `settings.payments` are rejected on live sales (400 `PAYMENT_METHOD_DISABLED`).

## Endpoints

### Session / staff
- `POST /pos/session` → `{ user:{id,email,name,role,photoUrl}, permissions:string[], store: StoreProfile, posConfig: PosConfig }`. 403 if role is CUSTOMER or inactive.
- `GET /pos/config` (pos.sell) → `PosConfig` (same object as `session.posConfig`; refetch after settings change).
  `PosConfig = { vatEnabled, vatRate /* 0 when VAT off */, receiptFooter, billPrefix, maxCashierDiscountPct, allowNegativeStock, requireCustomerForCounter, taxInvoice /* vatEnabled && store.pan */, payments: PaymentSettings, labels: LabelSettings, store: StoreProfile }` — no secrets.
- `GET /pos/staff` (staff.manage) → `StaffUser[]` ; `POST /pos/staff {email, name?, role}` ; `PATCH /pos/staff/:id {role?, isActive?}`.

### Catalog / inventory
- `GET /pos/catalog?updatedSince=ISO` → `PosProduct[]` (full snapshot when no param; used for offline cache).
  `PosProduct = { id, sku, barcode, name, brand, category, price, basePrice, salePrice, mrp, costPrice (only for catalog.write), vatApplicable, posVisible, stock, lowStockThreshold, imageUrl /* = primary image */, images:[PosImage], isActive, attributes:{shade?,batch?,expiry?,tester?}, variants:[PosVariant], updatedAt }`
  `PosImage = { id, url, isPrimary, sortOrder }` (primary first, then sortOrder). `PosVariant = { id, name, sku, barcode, price /* effective */, basePrice, salePrice, stock, attributes:{[k]:string} }`.
  Every product and variant has a `barcode` and `sku` (auto-issued, see "Barcodes & SKUs").
- `GET /pos/lookup?code=` → `PosProduct` matched by barcode (product, then variant), then SKU case-insensitively (product, then variant). 404 if none.
- `GET /pos/products?q&category&brand&lowStock&page&limit` ; `GET /pos/products/:id` ; `POST /pos/products` ; `PATCH /pos/products/:id` ; `DELETE /pos/products/:id` (soft) — catalog.write. Body = PosProduct writable fields (+ description, categoryId, brandId, images[] urls). Mutations revalidate storefront like existing admin product mutations.
- `POST /pos/inventory/adjust { productId, variantId?, delta, reason: RECEIVE|ADJUST|DAMAGE|RETURN|COUNT, note? }` → `{ stock }` ; `GET /pos/inventory/movements?productId&page`.

### Cash drawer (optional — "Till" in v1)
Selling never requires an open drawer. If the cashier has an open shift the sale is attached to it (`source_ref`), otherwise `source_ref = null`. UI wording: open = "Cash in drawer at start of day", close = "Cash counted at end of day".
- `POST /pos/till/open { openingFloat }` → `TillShift` (409 if cashier already has an open shift).
- `GET /pos/till/current` → `TillShift | null` (with running `cashSales`, `expectedCash`).
- `POST /pos/till/close { closingCash, notes? }` → `TillShift` (expected = opening cash + cash tenders − cash refunds; `variance`).
- `GET /pos/till/shifts?from&to&cashierId` (orders.read.all).
`TillShift = { id, cashierId, cashierName, openingFloat, closingCash, expectedCash, variance, status:'open'|'closed', openedAt, closedAt, totals:{ sales, orders, byMethod:{[method]:amount} } }`

### Sales (counter / phone / manual)
- `POST /pos/sales` → `{ order: PosOrder, bill: BillData }`
  ```
  { clientRef: string (uuid, idempotency key — required),
    shiftId?: string, channel?: 'POS_COUNTER'|'PHONE'|'MANUAL'|'WHATSAPP' (default POS_COUNTER),
    customer?: { id?, name?, phone?, email?, address? },          // omitted → walk-in customer
    items: [{ productId, variantId?, quantity, unitPrice?, lineDiscount? }],  // unitPrice override needs MANAGER
    discount?: number, notes?: string,
    delivery?: { required: boolean, address, city, branch?, codAmount?, charge? },  // phone/whatsapp delivery orders
    payments: [{ method, amount, reference? }],                   // sum must be ≥ total (change computed) unless delivery COD
    createdAt?: ISO }                                             // offline sale original time
  ```
  Server recomputes prices/VAT, decrements stock in one transaction, writes `order_payments`, sets `printable_ref` (bill number `GLM-<YYMMDD>-<seq>`), `cashier_id`, `source_ref=shiftId`.
  Replay of the same `clientRef` returns the original result (HTTP 200, `duplicate:true`).
- `POST /pos/sales/sync { sales: Sale[] }` (max 50) → `{ results: [{ clientRef, status:'created'|'duplicate'|'conflict'|'error', orderId?, printableRef?, reason?, conflicts?:[{productId, requested, available}] }] }`.
  Insufficient stock on sync ⇒ sale is still recorded (money was taken) with stock allowed to go negative AND flagged in `pos_sync_conflicts` for reconciliation; status `conflict`.
- `GET /pos/sync/conflicts` ; `POST /pos/sync/conflicts/:id/resolve { note }`.
`BillData = { printableRef, createdAt, cashierName, customer:{name,phone}, items:[{name, sku, qty, unitPrice, lineDiscount, vatApplicable, lineTotal}], subtotal, discount, deliveryCharge, taxableAmount, vatRate, vatAmount, vatEnabled, taxInvoice, total, payments:[{method,amount,reference}], tendered, change, due, footer, store: StoreProfile }`
  Bill rules (v2): no "estimate bill / not a tax invoice" text anywhere. `taxInvoice = vatEnabled && store.pan` → print "Tax invoice · PAN <pan>", otherwise no tax line. `vatEnabled:false` → `vatRate 0`, `vatAmount 0`, `taxableAmount = subtotal − discount`, print no VAT lines. `footer` = `pos.receiptFooter` or `''` (print nothing).

### Orders (all channels)
- `GET /pos/orders?channel&status&paymentStatus&from&to&q&cashierId&page&limit` → `PosOrder[]` + meta. CASHIER automatically scoped to own current shift.
- `GET /pos/orders/:id` → `PosOrder` (items, payments, shipment, timeline).
- `PATCH /pos/orders/:id/status { status, note? }` (orders.write) — runs side effects (NCM on PACKED, WhatsApp notify).
- `POST /pos/orders/:id/cancel { reason, restock: boolean }` — restocks transactionally.
- `POST /pos/orders/:id/refund { items?:[{orderItemId, quantity}], amount, method, reason, restock }` (counter returns).
`PosOrder = { id, orderNumber, printableRef, channel, status, paymentStatus, customer:{id,name,phone,email}, cashier:{id,name}|null, items:[...], subtotal, discountAmount, shippingCharge, vatAmount, totalAmount, payments:[...], shipment: Shipment|null, shippingAddress, notes, createdAt, updatedAt }`

### Customers
- `GET /pos/customers?q&page` ; `GET /pos/customers/:id` (with stats, recent orders) ; `POST /pos/customers {name, phone, email?, address?, marketingConsent?}` ; `PATCH /pos/customers/:id`.
- v2: khata removed — no `/pos/customers/:id/khata` routes (404), no `khataBalance`. The `customer_ledger` table is kept (no destructive migration) but unused.

### Analytics & reports (analytics.read)
- `GET /pos/analytics/summary?from&to&channel` → `{ totals:{revenue,orders,aov,items,grossMargin,refunds,vat,discounts}, byChannel:[{channel,revenue,orders,aov,items}], series:[{date,channel,revenue,orders}] }`
- `GET /pos/analytics/breakdown?from&to&channel&groupBy=channel|product|staff|hour|payment|category` → `[{ key, label, revenue, orders, items, margin }]`
- `GET /pos/reports/:type?from&to&channel&format=json|csv` — type ∈ `sales|vat|inventory|till|products`. CSV returned as `text/csv` attachment.

### Settings (settings.read / settings.write)
- `GET /pos/settings` → `{ store: StoreProfile, pos:{ vatEnabled, vatRate, receiptFooter, allowNegativeStock, maxCashierDiscountPct, billPrefix, requireCustomerForCounter }, payments: PaymentSettings, labels: LabelSettings, delivery:{ ncmEnabled, ncmPickupBranch, ncmEnv:'dev'|'prod', defaultDeliveryType }, whatsapp:{ enabled, phoneNumberDisplay, autoReplyEnabled, aiReplyEnabled } }` (never returns secrets).
  `PaymentSettings = { cash:{enabled}, fonepay:{enabled, merchantName, terminalId, qrImageUrl}, esewa:{enabled, accountName, accountId, qrImageUrl}, khalti:{enabled, accountName, accountId, qrImageUrl}, card:{enabled}, bank:{enabled, bankName, accountName, accountNumber, branch, qrImageUrl} }`
  `LabelSettings = { size:'38x25'|'50x25'|'A4-65', showPrice, showName }`
  Defaults: `vatEnabled:true`, `receiptFooter:''`, `requireCustomerForCounter:false`, every payment method `enabled:true` (owner switches off what the shop does not use), labels `38x25`/true/true.
- `PATCH /pos/settings` (deep partial of the same; unknown keys → 400). URLs (`qrImageUrl`, `logoUrl`) must be `''` or `https://`; text ≤ 120 chars (ids ≤ 60); `store.pan` `''` or 9 digits; `bank.accountNumber` 4–40 `[A-Za-z0-9 -]`; `payments.cash.enabled:false` → 400.
`StoreProfile = { name:'GLAMO Nepal', legalName, address:'S.S Chowk, Madhyapur Thimi, Bagmati', phone:'+977 9818212188', email, pan, vatNumber, logoUrl:'https://glamonepal.com/images/logo.png' }`
  Storefront `GET /settings/public` must expose the same address/phone.

### Delivery (Nepal Can Move) — delivery.manage
- `GET /pos/delivery/branches` (cached 7d) ; `GET /pos/delivery/rate?destination&type`.
- `GET /pos/orders/:id/shipment` ; `POST /pos/orders/:id/shipment` (manual "Send to NCM"; idempotent per order) ; `POST /pos/orders/:id/shipment/refresh` (poll NCM status).
`Shipment = { id, orderId, provider:'NCM', externalId, trackingCode, status, timeline:[{status, internalStatus, at, location?}], charge, codAmount, createdAt, updatedAt }`
- Webhooks (no auth header): `POST /delivery/ncm/webhook?secret=…` ; WhatsApp: `GET|POST /whatsapp/webhook`.

### WhatsApp inbox — whatsapp.inbox
- `GET /pos/whatsapp/conversations?status=open|handoff|all` → `[{ waId, phone, name, lastMessage, lastAt, unread, handoff, orderId? }]`
- `GET /pos/whatsapp/conversations/:waId` → messages ; `POST /pos/whatsapp/conversations/:waId/reply { text }` ; `POST /pos/whatsapp/conversations/:waId/resolve`.
- `POST /pos/whatsapp/broadcasts { templateName, language, audience:'consented'|'customerIds', customerIds? , params? }` (whatsapp.broadcast).

## Backend implementation notes (v1, branch wt/pos-core) — clarifications & deltas
These refine the contract above; the POS frontend should follow them.
- **Envelope**: paginated lists return `meta:{page,limit,total}` **and** the legacy `pagination:{page,limit,total,totalPages}`. Errors carry the machine code in `errors[0]` (e.g. `PAYMENT_METHOD_DISABLED`, `INSUFFICIENT_STOCK`, `PRICE_OVERRIDE_FORBIDDEN`, `DISCOUNT_LIMIT_EXCEEDED`).
- **Money**: the API speaks whole-rupee integers. Note the DB stores paisa (×100) in every money column (incl. `products.base_price`); the API converts at the edge.
- **VAT**: shelf prices are VAT-inclusive. VAT is extracted from the VAT-applicable net (after line + pro-rata order discount): `vat = round(net × rate / (100+rate))`; `taxableAmount` = that net − VAT. Website orders currently record `vat_amount = 0`.
- **Permissions**: extra internal permission `pos.override` (MANAGER+) gates `unitPrice` overrides and discounts above `pos.maxCashierDiscountPct`. Legacy role `STAFF` gets CASHIER permissions. Read endpoints `GET /pos/products`, `/pos/products/:id`, `/pos/customers`, `/pos/customers/:id`, `/pos/categories`, `/pos/brands`, `/pos/config` need only `pos.sell`; `/pos/sync/conflicts*` and `/pos/inventory/*` need `inventory.write`. `/pos/staff` cannot grant OWNER; only OWNER may grant SUPER_ADMIN; nobody may edit their own row.
- **Catalog**: `GET /pos/catalog` returns `meta.serverTime` — pass it as the next `updatedSince`. Delta responses include soft-deleted products with `deleted:true`. `PosProduct` also has `slug, brandId, categoryId, trackInventory`; `costPrice` only with `catalog.write`. `/pos/lookup` adds `matchedVariantId`. Products with active variants require `variantId` on sale lines (`VARIANT_REQUIRED`).
- **Sales**: (v2) no open till required; `shiftId` defaults to the cashier's open shift, else none. Offline sync may reference a closed shift of the same cashier. `createdAt` must be ≤ now+5 min and ≥ now−45 days (live: ≥ now−15 min). Delivery sales are created `CONFIRMED` (payment `PENDING`, method `CASH_ON_DELIVERY` while money is still due). Non-delivery sales are `DELIVERED`/`PAID`. Customers are matched by id, then last-10-digit phone, then email; created only when phone or email is given, else walk-in (`customer.id = 'pos-walk-in'`). Sale response: `{ order, bill, duplicate }` (+ top-level `duplicate`); 201 on create, 200 on replay. `BillData` additionally has `deliveryCharge, due, footer, vatEnabled, taxInvoice`. Sync `results[].status` adds per-sale `error` for validation failures.
- **Orders**: `PosOrder` additionally has `paymentMethod, shiftId, refundedAmount, cancelReason, timeline:[{status,note,by,at}], bill?` (bill snapshot for POS sales), `customer.walkIn`, and items carry `lineDiscount, lineTotal`. Transitions: PENDING→CONFIRMED→(PROCESSING)→PACKED→SHIPPED/OUT_FOR_DELIVERY→DELIVERED→RETURNED; CANCELLED via cancel. Cancelling a `WEBSITE` order delegates to the storefront cancel path (always restocks, refuses SHIPPED+); other channels are voided (tenders reversed as REFUND lines, payment `REFUNDED`, optional restock). Refunds: partial keeps `PAID`; reaching the paid amount sets `REFUNDED` (+ `RETURNED` if it had shipped/delivered). Cashiers' `GET /pos/orders` is scoped to their current (or latest) shift; `GET /pos/orders/:id` to their own sales.
- **Till**: `TillShift` additionally has `cashSales, notes`, `totals.refunds`. Refunds hit the refunder's open shift.
- **Analytics**: revenue = orders not CANCELLED with payment PAID or REFUNDED (gross); `totals.refunds` = refund tender lines; extra `totals.netRevenue`. `grossMargin` = total − shipping − VAT − current product cost. Summary also returns `range`.
- **Reports**: JSON = `{ type, range, columns, rows }`; CSV is UTF-8 with BOM, same columns.
- **Settings**: stored in `site_settings` key `pos_settings` (unknown keys rejected with 400). Patching `store.address/phone/email` mirrors into public `contact_info`/`support_phone`, so `GET /settings/public` agrees. `pos.billPrefix` must be 2–8 `[A-Z0-9]`.
- **Integration hooks** (`backend/src/modules/orders/order-events.ts`): `registerOrderStatusHandler(fn)` — called after every committed status change (admin + POS + cancel) and on POS sale creation with `previousStatus = null`; `registerShipmentResolver(fn)` fills `PosOrder.shipment`.
- **Rate limits** (per user): sales 60/min, sync 20/min, other POS writes 120/min.
- **Schema**: migration `0032_pos_commerce.sql` also adds `users.marketing_consent INTEGER DEFAULT 0` (for WhatsApp broadcast audience).

## Backend implementation notes — WhatsApp + Nepal Can Move (v1, branch wt/wa-ncm)
- **Gating**: NCM automation runs only when `settings.delivery.ncmEnabled` AND `NCM_API_TOKEN` is set (manual "Send to NCM" needs only the token). WhatsApp outbound needs `settings.whatsapp.enabled` + `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`; bot auto-replies additionally `autoReplyEnabled`; AI replies additionally `aiReplyEnabled` + env `WHATSAPP_AI_ENABLED=true` + `ANTHROPIC_API_KEY`. `delivery.ncmEnv` is informational — the NCM base URL comes from `NCM_API_BASE` (default prod portal).
- **Shipment** additionally has `lastStatus` (NCM's raw wording) and `error` (when `status:'ERROR'`). `status` ∈ `CREATING | ERROR | ORDER_CREATED | PICKED_UP | IN_TRANSIT | ARRIVED_AT_HUB | OUT_FOR_DELIVERY | DELIVERED | RETURNED_TO_SENDER`. `charge`/`codAmount` whole rupees. `trackingCode` = NCM order id.
- `POST /pos/orders/:id/shipment` body is optional `{ branch?, deliveryType?, weight?, instruction?, codAmount? }`; 201 + `created:true` when created, 200 + `created:false` when one already exists (never creates twice). An ERROR row may be retried with this call. NCM rejection → 502 `NCM_ERROR` (row kept as ERROR). Counter pickups → 400 `NO_DELIVERY_ADDRESS`. Destination branch: body `branch` → `shippingAddress.branch` → match of city/district against the branch list.
- `GET /pos/delivery/branches` → `[{ name, code, district, phone }]` (`?refresh=1` bypasses the 7-day cache). `GET /pos/delivery/rate?destination&type` → `{ creation, destination, type, charge }`. NCM not configured → 503 `NCM_NOT_CONFIGURED`.
- **Order status from NCM**: `OUT_FOR_DELIVERY`→order `OUT_FOR_DELIVERY`, `DELIVERED`→`DELIVERED` (COD payment → PAID), `RETURNED_TO_SENDER`→`RETURNED`. Applied through the normal status path (history, audit, WhatsApp side effects) by actor `system-integrations`, walking intermediate states (e.g. PACKED→OUT_FOR_DELIVERY→DELIVERED). Transition table now also allows `PACKED|SHIPPED|OUT_FOR_DELIVERY → RETURNED` (return-to-sender). Shipment status is monotonic; webhook replays are no-ops.
- **Webhooks**: NCM `POST /api/v1/delivery/ncm/webhook?secret=` (401 bad secret, 403 IP not in `NCM_WEBHOOK_IP_ALLOWLIST`, 503 unconfigured). WhatsApp `GET|POST /api/v1/whatsapp/webhook` (POST: 401 bad `X-Hub-Signature-256`). Both CSRF-exempt. Cron `*/30` polls in-flight shipments not touched for 2h (≤100/run, ≤5000/day).
- **Inbox**: `GET /pos/whatsapp/conversations` is paginated (`meta`) and items also carry `userId, state, lastInboundAt, windowOpen`. `GET …/:waId` → `{ waId, phone, name, userId, state, handoff, windowOpen, lastInboundAt, messages:[{id, waMessageId, direction:'in'|'out', type, body, mediaUrl, orderId, handledBy, status, createdAt}] }` (marks read). Reply outside the 24h window → 409 `WA_WINDOW_CLOSED`. Resolve → `{ waId, state:'resolved', handoff:false }`.
- **Broadcasts**: template must be APPROVED (checked via Graph; needs `WHATSAPP_WABA_ID`). Recipients always require `marketing_consent=1 AND whatsapp_opt_in=1` and a Nepal mobile, also for `audience:'customerIds'`. Max 250 sends per call: body accepts `offset`, response `{ eligible, sent, failed, skipped, offset, nextOffset, remaining, failures[] }`. `params` support `{{name}}`.
- **Status templates** (body params): `order_confirmed` [name, ref, "Rs total"], `order_packed` / `order_out_for_delivery` [name, ref, tracking or "-"], `order_delivered` / `order_returned` [name, ref]. Skipped for POS_COUNTER walk-in/pickup sales and for orders the WhatsApp bot itself created.
- **WhatsApp bot orders**: channel `WHATSAPP`, created through `processSale` (CONFIRMED, COD, delivery charge from the district fee table, fallback Rs 150); only when exactly one in-stock, variant-free product matches and phone + address are present — otherwise `handoff=1`. While `handoff=1` the bot stays silent.
- **Schema**: migration `0033_whatsapp_ncm.sql` (`shipments`, `wa_messages`, `wa_conversations`, `users.whatsapp_opt_in`).

## v2 additions (branch feat/pos-v2) — see also POS-V2-CHANGES.md

### Barcodes & SKUs
- Every product and variant gets a unique barcode + SKU automatically when created anywhere (POS, site admin `/api/v1/products`, supplier seed) if none was supplied. Generation lives in `backend/src/utils/product-codes.ts`.
- Barcode: EAN-13 in-store range `200` + 9-digit sequence (`barcode_sequence`, atomic `UPSERT … RETURNING`) + check digit. Generator skips values already typed in manually.
- SKU: `GLM-<BRAND3>-<6-digit seq>` (`sku_sequence`); BRAND3 = first 3 alphanumerics of the brand name upper-cased, else `GEN`.
- Manual codes allowed; uniqueness across products AND variants among live rows: 409 `BARCODE_TAKEN` / `SKU_TAKEN` (SKU compared case-insensitively). Manual barcodes: `[A-Za-z0-9._-/+]`, ≤64; a 13-digit code starting with `2` (in-store range) must have a valid EAN-13 check digit (400 `INVALID_BARCODE`). SKUs: `[A-Za-z0-9._-/+ ]`, ≤80 (400 `INVALID_SKU`). Sending `null`/`''` for a code on PATCH regenerates it (codes are never empty).
- `POST /pos/products/barcodes/backfill` (catalog.write) → `{ updated }` (idempotent). Also runs automatically once per worker isolate before `GET /pos/catalog`, and via `npm run db:backfill-barcodes`.
- `POST /pos/barcodes/next` (catalog.write) → `{ barcode }` — reserves the next in-store code for the product form's "Generate" button.

### Product photos (catalog.write)
- `POST /pos/products/:id/images` multipart field `file` (jpeg/png/webp ≤ 5 MB) → 201 `{ image: PosImage, images: PosImage[] }`. Cloudinary folder `products/<id>`. 503 `UPLOADS_NOT_CONFIGURED` without Cloudinary env; 502 `UPLOAD_FAILED`; 400 `FILE_REQUIRED` / `INVALID_IMAGE`; 400 `MAX_IMAGES_EXCEEDED` (10 per product).
- `POST /pos/products/:id/images/url { url }` → 201 `{ image, images }` (https Cloudinary / Google Drive / glamonepal.com, or `/images/…`; else 400 `INVALID_IMAGE_URL`).
- `PATCH /pos/products/:id/images/:imageId { isPrimary?: true, sortOrder?: 0..1000 }` → `{ image, images }` (exactly one primary).
- `DELETE /pos/products/:id/images/:imageId` → `{ id, deleted:true, images }` (next image becomes primary; Cloudinary asset removed best-effort).
- First image of a product is primary. Every change bumps `products.updated_at` (catalog delta) and revalidates the storefront.

### Variants (catalog.write)
- `POST /pos/products/:id/variants { name, sku?, barcode?, price? (default = product basePrice), salePrice?, stock? (default 0), attributes?: {[k]:string} }` → 201 `{ variant: PosVariant, product: PosProduct }`.
- `PATCH /pos/products/:id/variants/:variantId { name?, sku?, barcode?, price?, salePrice?, attributes?, isActive? }` → `{ variant: PosVariant | null /* null when made inactive */, product }`. Stock is not editable here — use `POST /pos/inventory/adjust { productId, variantId, … }`.
- `DELETE /pos/products/:id/variants/:variantId` → `{ id, deleted:true, product }` (soft; allowed even after the shade sold). Product stock = Σ active variant stock (0 when the last variant is removed).

### Categories / brands
- `GET /pos/categories` (pos.sell) → `[{ id, name, slug, parentId, description, imageUrl, sortOrder, isActive }]` (includes inactive).
- `POST /pos/categories { name, parentId?, description?, imageUrl?, sortOrder?, isActive? }` → 201 category ; `PATCH /pos/categories/:id` (partial) — catalog.write. 409 `CATEGORY_EXISTS` (case-insensitive name), 404 `PARENT_NOT_FOUND` / `CATEGORY_NOT_FOUND`.
- `GET /pos/brands` (pos.sell) → `[{ id, name, slug, description, logoUrl, website, isActive, productCount }]`.
- `POST /pos/brands { name, description?, logoUrl?, website?, isActive? }` → 201 brand ; `PATCH /pos/brands/:id` — catalog.write. 409 `BRAND_EXISTS`, 404 `BRAND_NOT_FOUND`. Renames bump the affected products' `updated_at` so offline catalogs pick up the new name.

### Uploads
- `POST /pos/uploads/image` multipart `file` (settings.write OR catalog.write) → 201 `{ url }` (Cloudinary folder `pos`) — QR codes, logo.

### Sales (v2)
- No open drawer needed (`TILL_NOT_OPEN` removed). A live sale naming a closed `shiftId` is attached to the cashier's open shift or none; offline sync keeps the original shift. Another cashier's shift → 403 `SHIFT_FORBIDDEN`.
- VAT only when `pos.vatEnabled`. Live sales: disabled tender → 400 `PAYMENT_METHOD_DISABLED`; `pos.requireCustomerForCounter` + POS_COUNTER without customer id/phone/email → 400 `CUSTOMER_REQUIRED`; `createdAt` older than 15 min → 400 `USE_SALES_SYNC`.
- Offline sync (`/pos/sales/sync`) records sales whose money was already taken even if the tender has since been switched off or the price changed (price differences are kept in the sale's audit log `overrides`).
- Cashier `GET /pos/orders` scope: own sales made today (Kathmandu) plus own sales in the open drawer shift.

