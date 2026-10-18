# Glamo CMS + POS (Steps 0–6)

Implemented on top of Nest API + Beauty Next.js admin.

## Run

```sh
# Terminal 1
cd apps/api && npx nest start

# Terminal 2
cd apps/web && npm run dev
```

Open http://127.0.0.1:3000 — login as Beauty store owner.

## What works (API-backed)

| Screen | Behavior |
| --- | --- |
| Products | List/create/edit/delete via `/api/commerce/products` → Nest |
| Inventory | List + receive/remove stock via `InventoryService` |
| Orders | List, change fulfillment, cancel+restock |
| Delivery | Assign driver/address/ETA; status on orders |
| Dashboard / Analytics | Live totals from `/v1/analytics/summary` |
| Beauty Counter POS | Catalog from API; checkout creates `channel=store` order only |

## Workspace

Top bar shows **Glamo Nepal** (no multi-tenant switcher). Delivery is in the sidebar.

## Deferred

Website Firebase cutover · WhatsApp/n8n
