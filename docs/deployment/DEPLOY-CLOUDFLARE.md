# Deploying to Cloudflare Workers (www.garageapothecary.com/worldcup2026)

## Prerequisites

- `garageapothecary.com` must be on Cloudflare (DNS managed by Cloudflare)
- Wrangler CLI authenticated: `npx wrangler login`

---

## Step 1 — Set environment variables

In your Cloudflare dashboard → **Workers & Pages → wcfantasy → Settings → Variables & Secrets**, add:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FOOTBALL_DATA_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
CRON_SECRET                    # openssl rand -hex 32
NEXT_PUBLIC_APP_URL            # https://www.garageapothecary.com/worldcup2026
```

---

## Step 2 — Deploy

```bash
cd worldcup-fantasy
npm install
npm run pages:build       # builds with OpenNext
npx wrangler deploy       # deploys to Cloudflare Workers + sets route
```

The `wrangler.toml` already has the route `www.garageapothecary.com/worldcup2026*` configured,
so traffic to that path will be routed to this worker automatically on first deploy.

---

## Step 3 — Deploy the Cron Worker

A separate Worker (`cron-worker/`) handles scheduled score syncing and pick scoring.

```bash
cd cron-worker
npm install

npx wrangler secret put APP_URL
# → enter: https://www.garageapothecary.com/worldcup2026

npx wrangler secret put CRON_SECRET
# → enter: same value as CRON_SECRET above

npm run deploy
```

Schedules (defined in `cron-worker/wrangler.toml`):
- `*/15 * * * *` → calls `/api/sync-scores`
- `*/10 * * * *` → calls `/api/score-picks`

Verify: **Cloudflare dashboard → Workers & Pages → wcfantasy-cron → Triggers**

---

## Step 4 — Bootstrap match data (run once)

```bash
curl -X POST https://www.garageapothecary.com/worldcup2026/api/bootstrap-matches \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Step 5 — Grant admin access

Sign up on the live app → copy your UUID from Supabase Auth → add to
`src/app/admin/page.tsx` → push to GitHub → redeploy.

---

## CI/CD (subsequent deploys)

Either deploy manually:
```bash
npm run pages:build && npx wrangler deploy
```

Or set up GitHub Actions — create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run pages:build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_APP_URL: https://www.garageapothecary.com/worldcup2026
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Add `CLOUDFLARE_API_TOKEN` (and the Supabase secrets) to your GitHub repo under
**Settings → Secrets and variables → Actions**.
