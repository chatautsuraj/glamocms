# Glamo Nepal — Nest audit + Phase 1 backend plan

**Date:** 18 September 2026  
**Repos audited:**
- Original kirana: https://github.com/chatautsuraj/flowdms → cloned to `../flowdms-kirana`
- Beauty / Glamo fork: this folder (`flowdms-main`) + https://flowdms-beauty.vercel.app

---

## 1. NestJS / Postgres audit (original repo)

### Verdict

**There is no NestJS app and no Postgres in `chatautsuraj/flowdms`.**

The repo is a single Next.js 15 app under `apps/web` (2 commits on `main`). Commerce data lives in Zustand + browser `persist` (`apps/web/src/lib/store.ts`), seeded from `mock-data.ts` (kirana / FMCG sample data).

| Expected (your brief) | Actual in `chatautsuraj/flowdms` |
| --- | --- |
| NestJS API | **Missing** — no `apps/api`, no `@nestjs/*` |
| Postgres + ORM | **Missing** — no Prisma/TypeORM/SQL |
| REST products/customers/orders | **Missing** — no API routes |
| API-key auth | **Missing** — demo auth in `localStorage` |
| `InventoryService.decrementStock()` | **Client-only** `deductStock()` in Zustand |
| Shared multi-channel source of truth | **No** — per-browser storage |

### What *does* exist (reuse as domain reference)

- Multi-tenant POS UI (dashboard, Galla counter, products, customers, orders, invoices, inventory, pricing, POs, reports)
- Stock path: `addInvoice` validates qty → `deductStock(lines)` mutates product stock in memory
- Entities in seed/store: products, customers, orders, invoices, payments, suppliers, price lists
- Beauty fork adds Glamo catalog (70 SKUs), cosmetics fields, expiry/tester sale blocks — still browser-local

### Implication for Phase 1

Phase 1 is **not** “extend existing Nest.” It is **greenfield NestJS + Postgres**, then point POS (and later WhatsApp / website) at it. Prefer scaffolding `apps/api` beside the Beauty web app so Glamo catalog and validation rules stay in one monorepo.

---

## 2. Phase 1 implementation plan (concrete)

### 2.1 Layout

```
flowdms-main/          (or a new monorepo branch on chatautsuraj/flowdms)
  apps/
    web/               # existing Next POS (Beauty)
    api/               # NEW NestJS + Prisma + Postgres
  docker-compose.yml   # Postgres only (self-hosted, no paid SaaS)
```

Self-host defaults: Postgres via Docker Compose on your machine/VPS; Nest on Node; no managed DB, no paid auth SaaS.

### 2.2 Schema (Prisma → Postgres)

Minimal shared truth matching your brief, plus keys needed for stock safety:

```prisma
enum OrderChannel {
  store
  website
  whatsapp
}

enum PaymentStatus {
  unpaid
  partial
  paid
}

model Product {
  id        String   @id @default(cuid())
  sku       String   @unique
  name      String
  price     Decimal  @db.Decimal(12, 2)
  stock     Int      @default(0)
  category  String?
  images    String[] // URLs
  // Beauty extras (nullable, from Glamo fork):
  brand     String?
  shade     String?
  batchNumber String?
  expiresOn DateTime?
  isTester  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  orderItems OrderItem[]
}

model Customer {
  id           String   @id @default(cuid())
  name         String
  phone        String?
  email        String?
  sourceChannel OrderChannel?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  orders       Order[]
}

model Order {
  id            String        @id @default(cuid())
  customerId    String?
  customer      Customer?     @relation(fields: [customerId], references: [id])
  amount        Decimal       @db.Decimal(12, 2)
  paymentStatus PaymentStatus @default(unpaid)
  channel       OrderChannel
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  items         OrderItem[]
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id])
  qty       Int
  unitPrice Decimal @db.Decimal(12, 2)
}
```

Optional later (not required for Phase 1 WhatsApp): invoices, VAT, multi-tenant `tenantId`. Keep v1 single-store for Glamo.

### 2.3 `InventoryService` (sole stock writer)

```ts
// apps/api/src/inventory/inventory.service.ts
async decrementStock(productId: string, qty: number, tx?: PrismaTransaction) {
  // UPDATE products SET stock = stock - qty
  // WHERE id = productId AND stock >= qty
  // throw InsufficientStockError if rowCount === 0
}
```

Rules:
- Only this method decreases stock (orders module, never controllers/n8n directly)
- Call inside the same DB transaction as order + order_items insert
- Reject qty ≤ 0; reject oversell atomically (no race between POS and WhatsApp)

### 2.4 REST endpoints (API-key protected)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/products` | List/search catalog |
| GET | `/products/:id` | One product + stock |
| POST | `/products` | Create (admin/POS seed) |
| PATCH | `/products/:id` | Update metadata (not raw stock hacks) |
| GET | `/customers` | List; filter by phone |
| POST | `/customers` | Upsert by phone |
| GET | `/customers/:id` | Detail + order history |
| GET | `/orders` | List; filter by channel / customer |
| GET | `/orders/:id` | Detail + items |
| POST | `/orders` | Create order: items[], channel, paymentStatus, customerId/phone — **calls InventoryService** |

Auth: header `X-API-Key: <secret>` (env `API_KEYS` comma-separated). Guard on all `/products|customers|orders` routes. Enough for n8n now and website later; no paid auth product.

### 2.5 Seed

One-time script: import Glamo catalog from Beauty fork (`apps/web/src/lib/glamo-catalog.json` / `catalog.ts`) into `products` so POS and WhatsApp share the same SKUs.

### 2.6 POS demo test (prove Phase 1)

Without full UI rewrite:

1. Run Postgres + `apps/api`
2. Seed products
3. Script or curl: `POST /orders` with `channel=store`, assert stock decremented
4. Thin adapter in Beauty web (optional stretch): replace `deductStock` path for one Galla sale with `POST /orders` so UI sale hits Postgres

Success criteria: one Postgres query shows product stock and order row consistent after a store sale.

### 2.7 Build order (this phase only)

1. `docker-compose.yml` + Prisma schema + migrate  
2. Nest modules: `PrismaModule`, `InventoryModule`, `ProductsModule`, `CustomersModule`, `OrdersModule`, `ApiKeyGuard`  
3. Seed Glamo products  
4. Integration tests / curl checklist for create order + stock  
5. Document env vars (`DATABASE_URL`, `API_KEYS`) for n8n Phase 2  

**Out of scope until Phase 1 green:** WhatsApp/n8n, multi-channel consistency suite, Firebase website cutover.

---

## 3. Access notes (unlock done)

- Git for Windows **2.55.0** installed on this machine  
- Repo cloned: `C:\Users\HP User\Downloads\SURAJ PROJECTS\flowdms-kirana`  
- Remote: `https://github.com/chatautsuraj/flowdms.git` @ `8333a79`

---

## 4. Recommended next step

Approve implementation of **§2** in this Beauty tree as `apps/api` (greenfield Nest + Postgres). Do not assume Nest already exists in git.
