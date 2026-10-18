# Deploy GLAMO POS to Cloudflare Workers

GLAMO POS runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare),
the same setup as the glamonepal.com storefront. Worker name `glamo-pos`, custom domain
`pos.glamonepal.com` (see `apps/web/wrangler.jsonc`).

## One-time

1. `cd apps/web && npm install`
2. `npx wrangler login` (account that owns the `glamonepal.com` zone).
3. Build-time env (public values only — inlined into the bundle). Create `apps/web/.env.production`
   (git-ignored) or export them in CI:
   ```env
   NEXT_PUBLIC_API_URL=https://api.glamonepal.com
   NEXT_PUBLIC_FIREBASE_API_KEY=…            # same values as the storefront
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=…
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=…
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
   NEXT_PUBLIC_FIREBASE_APP_ID=…
   ```
   If unset, the app falls back to `https://api.glamonepal.com` and the shared GLAMO Firebase web config.
4. Firebase console → Authentication → Settings → **Authorized domains**: add `pos.glamonepal.com`.
5. Backend: `https://pos.glamonepal.com` is always CORS-allowed by the API; no secrets are shared with the POS Worker.

## Every release

```sh
cd apps/web
npm run typecheck && npm run lint && npm test && npm run build
npm run deploy:cf      # opennextjs-cloudflare build && wrangler deploy
```

- `npm run preview:cf` — build and run the Worker locally with `wrangler dev`.
- `npm run build:cf` — build only (`.open-next/`).

The first deploy creates the `pos.glamonepal.com` custom domain route. The service worker
(`/sw.js`) is served with `Cache-Control: no-cache`; bump `VERSION` in `public/sw.js` to force
clients to drop old shell caches.
