# Deploying Soccer Fantasy Game

## Stack
- **Next.js 14** (App Router) on **Vercel**
- **Supabase** (Auth + PostgreSQL + Realtime)
- **football-data.org** (free tier, 10 req/min)
- **Resend** (transactional email)

---

## Step 1 — Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste the full contents of `schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Auth → Email** — enable Email OTP (magic link) and Email/Password

---

## Step 2 — Football data API

1. Sign up at [football-data.org](https://www.football-data.org/client/register)
2. Free tier: 10 requests/minute, full WC data
3. Copy your API key → `FOOTBALL_DATA_API_KEY`

---

## Step 3 — Resend (email)

1. Sign up at [resend.com](https://resend.com)
2. Add + verify your sending domain
3. Copy API key → `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL=noreply@yourdomain.com`

---

## Step 4 — Deploy to Vercel

```bash
npm install -g vercel
cd soccer-fantasy-game
vercel
```

Set all env vars in the Vercel dashboard (Settings → Environment Variables):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FOOTBALL_DATA_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
CRON_SECRET          # generate: openssl rand -hex 32
NEXT_PUBLIC_APP_URL  # your Vercel URL, e.g. https://soccer-fantasy.vercel.app
```

---

## Step 5 — Seed match data (ONE TIME)

After deploying, call the bootstrap route once to pull all 2026 WC matches + teams from football-data.org:

```bash
curl -X POST https://your-app.vercel.app/api/bootstrap-matches \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

This populates the `teams` and `matches` tables. You only run this once.

---

## Step 6 — Grant yourself admin

1. Sign up on your deployed app to get your user UUID
2. Copy it from Supabase → Authentication → Users
3. Paste it into `src/app/admin/page.tsx` → `ADMIN_USER_IDS` array
4. Redeploy

Access admin at `/admin` to:
- Manually override scores
- Trigger score sync + pick scoring
- View player stats

---

## Cron jobs (auto-managed by Vercel)

`vercel.json` sets up three crons automatically:

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/sync-scores` | Every 5 min | Pull live scores from football-data.org |
| `/api/score-picks` | Every 10 min | Score picks for finished matches, update leaderboards |
| `/api/notify-picks-reminder` | Daily 6pm | Email users with unpicked upcoming matches |

Vercel free tier includes 2 cron jobs; upgrade to Vercel Pro ($20/mo) for unlimited crons.  
Alternative: use [cron-job.org](https://cron-job.org) (free) to call your endpoints with the cron secret header.

---

## Scoring system

| Event | Points |
|-------|--------|
| Correct W/D/L result | 3 pts |
| Exact score | 5 pts (3 + 2 bonus) |
| Both multiplied by confidence (1×/2×/3×) | |
| Correct tournament champion | 10 pts |
| Correct runner-up | 5 pts |
| Correct golden boot | 5 pts |

Each player has three confidence tokens (1×, 2×, 3×) per pick — they can apply any multiplier to any match.

Adjust values in Supabase → Table Editor → `scoring_config`.

---

## Local development

```bash
cp .env.example .env.local
# fill in your env vars

npm install
npm run dev
# visit http://localhost:3000
```
