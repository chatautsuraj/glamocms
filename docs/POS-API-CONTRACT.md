# GLAMO POS ⇄ api.glamonepal.com — API contract (v1)

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
- payment `method` (tender lines): `CASH | FONEPAY_QR | KHALTI | ESEWA | CARD | BANK_TRANSFER | CREDIT` (CREDIT = customer khata).

## Endpoints

### Session / staff
- `POST /pos/session` → `{ user:{id,email,name,role,photoUrl}, permissions:string[], store: StoreProfile }`. 403 if role is CUSTOMER or inactive.
- `GET /pos/staff` (staff.manage) → `StaffUser[]` ; `POST /pos/staff {email, name?, role}` ; `PATCH /pos/staff/:id {role?, isActive?}`.

### Catalog / inventory
- `GET /pos/catalog?updatedSince=ISO` → `PosProduct[]` (full snapshot when no param; used for offline cache).
  `PosProduct = { id, sku, barcode, name, brand, category, price, basePrice, salePrice, mrp, costPrice (only for catalog.write), vatApplicable, posVisible, stock, lowStockThreshold, imageUrl, isActive, attributes:{shade?,batch?,expiry?,tester?}, variants:[{id,name,sku,barcode,price,stock}], updatedAt }`
- `GET /pos/lookup?code=` → `PosProduct` matched by barcode, then SKU (product or variant). 404 if none.
- `GET /pos/products?q&category&brand&lowStock&page&limit` ; `GET /pos/products/:id` ; `POST /pos/products` ; `PATCH /pos/products/:id` ; `DELETE /pos/products/:id` (soft) — catalog.write. Body = PosProduct writable fields (+ description, categoryId, brandId, images[] urls). Mutations revalidate storefront like existing admin product mutations.
- `POST /pos/inventory/adjust { productId, variantId?, delta, reason: RECEIVE|ADJUST|DAMAGE|RETURN|COUNT, note? }` → `{ stock }` ; `GET /pos/inventory/movements?productId&page`.

### Till
- `POST /pos/till/open { openingFloat }` → `TillShift` (409 if cashier already has an open shift).
- `GET /pos/till/current` → `TillShift | null` (with running `cashSales`, `expectedCash`).
- `POST /pos/till/close { closingCash, notes? }` → `TillShift` (expected = float + cash tenders − cash refunds; `variance`).
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
`BillData = { printableRef, createdAt, cashierName, customer:{name,phone}, items:[{name, sku, qty, unitPrice, lineDiscount, vatApplicable, lineTotal}], subtotal, discount, taxableAmount, vatRate, vatAmount, total, payments:[{method,amount,reference}], tendered, change, store: StoreProfile }`

### Orders (all channels)
- `GET /pos/orders?channel&status&paymentStatus&from&to&q&cashierId&page&limit` → `PosOrder[]` + meta. CASHIER automatically scoped to own current shift.
- `GET /pos/orders/:id` → `PosOrder` (items, payments, shipment, timeline).
- `PATCH /pos/orders/:id/status { status, note? }` (orders.write) — runs side effects (NCM on PACKED, WhatsApp notify).
- `POST /pos/orders/:id/cancel { reason, restock: boolean }` — restocks transactionally.
- `POST /pos/orders/:id/refund { items?:[{orderItemId, quantity}], amount, method, reason, restock }` (counter returns).
`PosOrder = { id, orderNumber, printableRef, channel, status, paymentStatus, customer:{id,name,phone,email}, cashier:{id,name}|null, items:[...], subtotal, discountAmount, shippingCharge, vatAmount, totalAmount, payments:[...], shipment: Shipment|null, shippingAddress, notes, createdAt, updatedAt }`

### Customers
- `GET /pos/customers?q&page` ; `GET /pos/customers/:id` (with stats, recent orders, khataBalance) ; `POST /pos/customers {name, phone, email?, address?, marketingConsent?}` ; `PATCH /pos/customers/:id`.
- `POST /pos/customers/:id/khata { type:'CHARGE'|'PAYMENT', amount, method?, note? }` → `{ balance }` ; `GET /pos/customers/:id/khata`.

### Analytics & reports (analytics.read)
- `GET /pos/analytics/summary?from&to&channel` → `{ totals:{revenue,orders,aov,items,grossMargin,refunds,vat,discounts}, byChannel:[{channel,revenue,orders,aov,items}], series:[{date,channel,revenue,orders}] }`
- `GET /pos/analytics/breakdown?from&to&channel&groupBy=channel|product|staff|hour|payment|category` → `[{ key, label, revenue, orders, items, margin }]`
- `GET /pos/reports/:type?from&to&channel&format=json|csv` — type ∈ `sales|vat|inventory|till|products`. CSV returned as `text/csv` attachment.

### Settings (settings.read / settings.write)
- `GET /pos/settings` → `{ store: StoreProfile, pos:{ vatRate, receiptFooter, allowNegativeStock, maxCashierDiscountPct, billPrefix }, delivery:{ ncmEnabled, ncmPickupBranch, ncmEnv:'dev'|'prod', defaultDeliveryType }, whatsapp:{ enabled, phoneNumberDisplay, autoReplyEnabled, aiReplyEnabled } }` (never returns secrets).
- `PATCH /pos/settings` (partial of the same).
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
- **Envelope**: paginated lists return `meta:{page,limit,total}` **and** the legacy `pagination:{page,limit,total,totalPages}`. Errors carry the machine code in `errors[0]` (e.g. `TILL_NOT_OPEN`, `INSUFFICIENT_STOCK`, `PRICE_OVERRIDE_FORBIDDEN`, `DISCOUNT_LIMIT_EXCEEDED`).
- **Money**: the API speaks whole-rupee integers. Note the DB stores paisa (×100) in every money column (incl. `products.base_price`); the API converts at the edge.
- **VAT**: shelf prices are VAT-inclusive. VAT is extracted from the VAT-applicable net (after line + pro-rata order discount): `vat = round(net × rate / (100+rate))`; `taxableAmount` = that net − VAT. Website orders currently record `vat_amount = 0`.
- **Permissions**: extra internal permission `pos.override` (MANAGER+) gates `unitPrice` overrides and discounts above `pos.maxCashierDiscountPct`. Legacy role `STAFF` gets CASHIER permissions. Read endpoints `GET /pos/products`, `/pos/products/:id`, `/pos/customers`, `/pos/customers/:id`, `/pos/customers/:id/khata` need only `pos.sell`; `POST /pos/customers/:id/khata` needs `customers.write`; `/pos/sync/conflicts*` and `/pos/inventory/*` need `inventory.write`. `/pos/staff` cannot grant OWNER; only OWNER may grant SUPER_ADMIN; nobody may edit their own row.
- **Catalog**: `GET /pos/catalog` returns `meta.serverTime` — pass it as the next `updatedSince`. Delta responses include soft-deleted products with `deleted:true`. `PosProduct` also has `slug, brandId, categoryId, trackInventory`; `costPrice` only with `catalog.write`. `/pos/lookup` adds `matchedVariantId`. Products with active variants require `variantId` on sale lines (`VARIANT_REQUIRED`).
- **Sales**: live `POS_COUNTER` sales need an open till for the cashier (409 `TILL_NOT_OPEN`); `shiftId` defaults to the cashier's open shift. Offline sync may reference a closed shift of the same cashier. `createdAt` must be ≤ now+5 min and ≥ now−45 days. Delivery sales are created `CONFIRMED` (payment `PENDING`, method `CASH_ON_DELIVERY` while money is still due). Non-delivery sales are `DELIVERED`/`PAID`. CREDIT tenders need a named customer (phone/email/id) and post a khata CHARGE. Customers are matched by id, then last-10-digit phone, then email; created only when phone or email is given, else walk-in (`customer.id = 'pos-walk-in'`). Sale response: `{ order, bill, duplicate }` (+ top-level `duplicate`); 201 on create, 200 on replay. `BillData` additionally has `deliveryCharge, due, footer`. Sync `results[].status` adds per-sale `error` for validation failures.
- **Orders**: `PosOrder` additionally has `paymentMethod, shiftId, refundedAmount, cancelReason, timeline:[{status,note,by,at}], bill?` (bill snapshot for POS sales), `customer.walkIn`, and items carry `lineDiscount, lineTotal`. Transitions: PENDING→CONFIRMED→(PROCESSING)→PACKED→SHIPPED/OUT_FOR_DELIVERY→DELIVERED→RETURNED; CANCELLED via cancel. Cancelling a `WEBSITE` order delegates to the storefront cancel path (always restocks, refuses SHIPPED+); other channels are voided (tenders reversed as REFUND lines, payment `REFUNDED`, optional restock). Refunds: partial keeps `PAID`; reaching the paid amount sets `REFUNDED` (+ `RETURNED` if it had shipped/delivered). Cashiers' `GET /pos/orders` is scoped to their current (or latest) shift; `GET /pos/orders/:id` to their own sales.
- **Till**: `TillShift` additionally has `cashSales, notes`, `totals.refunds`. Cash khata payments taken during a shift count toward expected cash. Refunds hit the refunder's open shift.
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
