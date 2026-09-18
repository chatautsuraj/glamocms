# Phase 1 complete — 17 September 2026

Shared commerce backend is running locally.

## What was built

| Piece | Location |
| --- | --- |
| NestJS API | `apps/api` |
| SQLite DB (local) | `apps/api/prisma/dev.db` |
| Docker Compose (Postgres optional) | `docker-compose.yml` |
| Glamo seed (70 SKUs) | `npm run prisma:seed` |
| Smoke script | `npm run smoke` — **PASS** (stock 12→11) |
| POS BFF | `apps/web/src/app/api/commerce/orders/route.ts` |
| POS dual-write | `store.ts` → `mirrorStoreOrderToApi` after invoice |

## Run

```sh
# Terminal 1 — API
cd apps/api
npm run start:dev   # http://127.0.0.1:3001/v1

# Terminal 2 — POS
cd apps/web
# copy .env.local.example → .env.local if needed
npm run dev         # http://127.0.0.1:3000
```

API key: `pos-local-dev` (header `X-API-Key`)  
Health: `GET /v1/health` (public)

## Note on database

Phase 1 uses **SQLite** so it works without Docker. `docker-compose.yml` is ready for Postgres when you want to switch (see `apps/api/README.md`).

## Next

Phase 2: self-hosted n8n + Meta WhatsApp Cloud API calling the same `/v1` endpoints.
