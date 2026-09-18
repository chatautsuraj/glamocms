# NestJS / Postgres audit summary (Glamo Phase 1 prep)

Full write-up lives next to the cloned original repo:

**[`../flowdms-kirana/NEST-AUDIT.md`](../../flowdms-kirana/NEST-AUDIT.md)**  
**Phase 1 plan:** [`../flowdms-kirana/PHASE1-PLAN.md`](../../flowdms-kirana/PHASE1-PLAN.md)

## One-line finding

`https://github.com/chatautsuraj/flowdms` (kirana) and this Beauty fork are both **Next.js + Zustand browser demos**. There is **no NestJS and no Postgres** to extend — Phase 1 must **scaffold** `apps/api` (see Phase 1 plan).

## This Beauty fork (what we keep as reference)

- Path: this folder (`apps/web`)
- Live: https://flowdms-beauty.vercel.app
- Glamo catalog + cosmetics fields + checkout validation
- Stock today: `deductStock()` in `apps/web/src/lib/store.ts` (client-only)
