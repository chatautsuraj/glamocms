# Glamo Nepal — Store CMS + POS

Next.js CMS (`apps/web`) + NestJS commerce API (`apps/api`).

## Local

```bash
# API (port 3001)
cd apps/api && npm install && npx prisma db push && npx prisma db seed && npx nest start

# Web (port 3000)
cd apps/web && npm install && npm run dev
```

Open http://127.0.0.1:3000 — demo: **Fill demo staff login**.

## Env

**API** `apps/api/.env` — see `.env.example`  
**Web** (optional) `GLAMO_API_URL`, `GLAMO_API_KEY` for BFF → Nest

## Deploy

- Vercel: root `vercel.json` builds `apps/web` → set domain `glamocms.vercel.app`
- Nest API must be hosted separately (Postgres recommended); set `GLAMO_API_URL` on Vercel

See `NEXT-STEPS.md`.
