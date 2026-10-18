# Deploy Glamo Phase 1 live (shared Nest + Postgres + Vercel web)

## Goal

Make [glamocms.vercel.app](https://glamocms.vercel.app) talk to a **hosted Nest API** so stock/orders are shared across devices (not only browser localStorage).

## 1. Host Postgres + API

### Option A — Docker on a VPS

```sh
# From repo root
docker compose up -d --build
curl -s http://127.0.0.1:3001/v1/health
```

API: `http://YOUR_SERVER:3001/v1`  
Key: `pos-local-dev` (change `API_KEYS` in compose for production)

### Option B — Render Blueprint

1. Push this repo to GitHub
2. Render → New → Blueprint → select `render.yaml`
3. Copy the generated `API_KEYS` and the service URL (e.g. `https://glamo-api.onrender.com/v1`)

### Option C — Railway

1. New project → Deploy from repo → root `apps/api`
2. Add Postgres plugin; set `DATABASE_URL`
3. Set `API_KEYS`, `PORT=3001`
4. Before first start, switch Prisma provider to `postgresql` (see below) and run migrate

## 2. Switch Prisma to Postgres (if still on SQLite)

Edit `apps/api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then:

```sh
cd apps/api
npx prisma migrate deploy
npm run prisma:seed
```

Local SQLite remains fine for laptop-only; production must use Postgres.

## 3. Wire Vercel (web)

In Vercel project **glamocms** → Settings → Environment Variables (Production):

| Name | Value |
| --- | --- |
| `GLAMO_API_URL` | `https://YOUR-API-HOST/v1` |
| `GLAMO_API_KEY` | same as one key in `API_KEYS` |
| `GLAMO_API_TIMEOUT_MS` | `8000` (raise from 600ms for cold starts) |

Redeploy web: `npx vercel --prod` from repo root (or push to GitHub if auto-deploy is on).

## 4. Verify

```sh
curl -H "X-API-Key: YOUR_KEY" https://YOUR-API-HOST/v1/products
# Then open glamocms.vercel.app → POS sale → confirm stock drops on another browser
```

## Notes

- Nest is **not** runnable as a Vercel serverless function in this layout; host API separately.
- Until `GLAMO_API_URL` is set, the web app keeps using localStorage fallback (safe offline demo).
- Channel intake (WhatsApp / n8n / delivery partner): see [CHANNELS.md](CHANNELS.md).
- After API is live, open Till, Returns, Purchase receiving, and Reports in the CMS nav.
