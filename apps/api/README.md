# Glamo / FlowDMS API (Phase 1)

Shared NestJS backend for POS, WhatsApp (Phase 2), and website (Phase 4).

## Stack

- NestJS + Prisma
- **SQLite by default** (`prisma/dev.db`) so Phase 1 runs without Docker
- Optional Postgres via root `docker-compose.yml` (switch `provider` + `DATABASE_URL` when ready)

## Quick start

```sh
cd apps/api
cp .env.example .env   # already present in this tree
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

API: http://127.0.0.1:3001/v1  
Health (no key): `GET /v1/health`  
Auth: header `X-API-Key: pos-local-dev` (see `API_KEYS` in `.env`)

## Smoke test

With the API running:

```sh
npm run smoke
```

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/v1/health` | Public |
| GET/POST | `/v1/products` | List/create |
| GET/PATCH | `/v1/products/:id` | Detail/update (not stock) |
| GET/POST | `/v1/customers` | List/create |
| GET | `/v1/customers/:id` | + recent orders |
| GET/POST | `/v1/orders` | Create decrements stock via `InventoryService` only |

### Create order

```json
{
  "channel": "store",
  "paymentStatus": "paid",
  "customer": { "name": "Walk-in", "phone": "98..." },
  "items": [{ "productId": "...", "qty": 1 }]
}
```

`channel`: `store` | `website` | `whatsapp`

## POS dual-write

Beauty Next.js can call `POST /api/commerce/orders` (BFF) which forwards to this API with the server-side key so the browser never sees `API_KEYS`.

## Postgres later

1. `docker compose up -d` from repo root  
2. Change Prisma `provider` to `postgresql` and set  
   `DATABASE_URL=postgresql://glamo:glamo@127.0.0.1:5432/glamo?schema=public`  
3. `npx prisma migrate dev`
