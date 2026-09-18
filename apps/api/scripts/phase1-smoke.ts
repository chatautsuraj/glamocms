/**
 * Phase 1 smoke: list products, create order (channel=store), assert stock decreased.
 * Requires API running on PORT (default 3001) with seeded DB.
 */
const BASE = process.env.API_URL ?? 'http://127.0.0.1:3001/v1';
const KEY = process.env.API_KEY ?? 'pos-local-dev';

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': KEY,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
  }
  return body;
}

async function main() {
  const health = await fetch(BASE.replace(/\/v1$/, '/v1/health'));
  if (!health.ok) throw new Error('API health check failed — is the server running?');

  const products = await api('/products');
  if (!Array.isArray(products) || products.length < 1) {
    throw new Error('No products — run npm run prisma:seed');
  }

  const product = products.find((p: { stock: number; isTester: boolean }) => p.stock > 0 && !p.isTester);
  if (!product) throw new Error('No in-stock sellable product');

  const before = product.stock;
  console.log(`Using ${product.sku} stock=${before}`);

  const order = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      channel: 'store',
      paymentStatus: 'paid',
      customer: { name: 'Phase1 Smoke Customer', phone: '9800000001' },
      items: [{ productId: product.id, qty: 1 }],
    }),
  });

  const afterProduct = await api(`/products/${product.id}`);
  if (afterProduct.stock !== before - 1) {
    throw new Error(`Stock expected ${before - 1}, got ${afterProduct.stock}`);
  }

  console.log('PASS: order', order.id, 'channel=', order.channel, 'amount=', order.amount);
  console.log('PASS: stock', before, '->', afterProduct.stock);
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e);
  process.exit(1);
});
