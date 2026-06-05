# Deploying to Cloudflare Pages (garageapothecary.com/world_cup2026)

## Step 1 — Push to GitHub

```bash
cd worldcup-fantasy
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/wcfantasy.git
git push -u origin main
```

## Step 2 — Create a Cloudflare Pages project

1. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages**
2. Connect your GitHub account → select the `wcfantasy` repo
3. Set build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `.vercel/output/static`
4. Add all environment variables (click "Add variable" for each):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FOOTBALL_DATA_API_KEY
CRON_SECRET                    # openssl rand -hex 32
NEXT_PUBLIC_APP_URL            # https://garageapothecary.com/world_cup2026
```

5. Click **Save and Deploy** — first build takes ~2 min.

## Step 3 — Add custom domain path

Cloudflare Pages doesn't support subdirectory routing natively, but since
garageapothecary.com is already on Cloudflare you can use a Worker Route:

1. Go to **Workers & Pages → Create → Worker**
2. Name it `wcfantasy-router`, paste this code:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/world_cup2026')) {
      // Forward to your Pages project URL
      const pagesUrl = new URL(request.url)
      pagesUrl.hostname = 'wcfantasy.pages.dev'  // your Pages project URL
      return fetch(pagesUrl.toString(), request)
    }
    return fetch(request)  // pass everything else through
  }
}
```

3. Go to **Workers & Pages → your Worker → Settings → Triggers → Add Route**
4. Set route: `garageapothecary.com/world_cup2026*`
5. Zone: `garageapothecary.com`

## Step 4 — Enable Cron Triggers

1. Go to **Workers & Pages → wcfantasy (your Pages project) → Settings → Triggers**
2. Add two cron triggers:
   - `*/10 * * * *`
   - `*/15 * * * *`

These fire the `scheduled()` handler in `_worker.ts` which calls your API routes.

## Step 5 — Bootstrap match data (run once)

```bash
curl -X POST https://garageapothecary.com/world_cup2026/api/bootstrap-matches \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Step 6 — Grant admin access

Sign up on the live app → copy your UUID from Supabase Auth → add to
`src/app/admin/page.tsx` → push to GitHub → Cloudflare auto-redeploys.

---

## Subsequent deploys

Just push to `main` — Cloudflare Pages auto-builds on every push.

```bash
git add .
git commit -m "your message"
git push
```
