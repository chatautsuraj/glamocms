# Phase 2 channels — WhatsApp / n8n / delivery partner

Wire these after Nest is hosted (`DEPLOY.md`) and `GLAMO_API_URL` is set on Vercel.

## WhatsApp Cloud API

1. Create a Meta WhatsApp Business app and subscribe to webhooks.
2. Set on the API host:

```env
WHATSAPP_VERIFY_TOKEN=glamo-verify
# optional: WHATSAPP_APP_SECRET=
```

3. Webhook URL (public Nest):

- Verify GET: `https://YOUR-API-HOST/v1/channels/whatsapp/webhook`
- Events POST: same path

4. Create orders from n8n / automation (API key required):

`POST /v1/channels/whatsapp/orders`

```json
{
  "customerName": "Sita",
  "customerPhone": "98xxxxxxxx",
  "deliveryAddress": "Thimi",
  "notes": "from Instagram DM",
  "items": [{ "productId": "cuid…", "qty": 1 }]
}
```

Header: `X-API-Key: <one of API_KEYS>`

Stock decrements through the same inventory service as POS.

## n8n recipe (minimal)

1. **Webhook** node → receives website / WhatsApp form
2. **HTTP Request** → `POST {{$env.GLAMO_API_URL}}/channels/whatsapp/orders` with `X-API-Key`
3. Optional: **HTTP Request** → Pathao / partner via `DELIVERY_PARTNER_URL`

Include `n8n-local` (or your key) in `API_KEYS` on the API.

## Delivery partner (Pathao etc.)

On the API:

```env
DELIVERY_PARTNER=http
DELIVERY_PARTNER_URL=https://partner.example.com/api
DELIVERY_PARTNER_KEY=…
```

Store Delivery UI → **Send to partner** calls `POST /v1/orders/:id/dispatch`, which posts to `{DELIVERY_PARTNER_URL}/shipments`.

Until configured, dispatch records a **manual** tracking id (unchanged stub).

## Fonepay webhook (optional)

`POST /v1/payments/webhook/fonepay` with body:

```json
{ "orderId": "…", "amount": 1500, "externalRef": "FP-…" }
```

Marks the order paid and stores a `PaymentConfirmation`. POS also confirms manually when the cashier taps **Paid**.

## Smoke checklist

```sh
curl -s https://YOUR-API-HOST/v1/health
curl -H "X-API-Key: KEY" https://YOUR-API-HOST/v1/products
curl -X POST -H "X-API-Key: KEY" -H "Content-Type: application/json" \
  -d '{"customerName":"Test","items":[{"productId":"…","qty":1}]}' \
  https://YOUR-API-HOST/v1/channels/whatsapp/orders
```
