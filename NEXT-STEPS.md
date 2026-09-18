# Glamo CMS — next steps

## Done this session
- POS PDF bill download + print
- Phone call order desk (customer + phone channel order → Orders/Delivery)
- Camera barcode scan, stock barcodes, admin VAT (optional per SKU)
- Delivery partner stub (`DELIVERY_PARTNER_*`)
- Product fetch cache + Next package import optimizations

## Recommended next
1. **Host Nest API** on Railway/Render/Fly with Postgres (SQLite is local-only; Vercel needs a remote API URL via `GLAMO_API_URL`).
2. **Wire real payment QR** (Fonepay / eSewa / Khalti) instead of placeholder payload.
3. **Connect delivery partner** (Pathao etc.) using `DELIVERY_PARTNER_URL` + key.
4. **Website channel** — public shop reading same Nest catalog (`channel: website`).
5. **WhatsApp / n8n** order intake into Nest.
6. **Auth** — replace demo password store with real sessions (Clerk/Auth.js).
7. **Image CDN** for product photos (R2/S3).
8. **Mobile PWA** for counter + camera scan offline-ish.

## Deploy notes
- Vercel project: **glamocms** → `glamocms.vercel.app` (Next `apps/web`).
- Set `GLAMO_API_URL` + `GLAMO_API_KEY` in Vercel env to your hosted Nest API.
- Until API is public, local: web `:3002`, API `:3001`.
