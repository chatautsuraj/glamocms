# Deploy Glamo CMS to Vercel (run once on this PC)

Prereq: `npx vercel login` (browser) while you're at the laptop.

```powershell
cd "C:\Users\HP User\Downloads\SURAJ PROJECTS\flowdms-main\flowdms-main\apps\web"
npx vercel login
npx vercel link --yes --project glamocms
npx vercel --prod --yes
npx vercel alias set <deployment-url> glamocms.vercel.app
```

Or import https://github.com/chatautsuraj/glamocms in the Vercel dashboard:
- Root Directory: `apps/web`
- Framework: Next.js
- Domain: `glamocms.vercel.app`

Optional env (when Nest API is hosted):
- `GLAMO_API_URL`
- `GLAMO_API_KEY`
