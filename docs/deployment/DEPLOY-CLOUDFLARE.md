# Deploying to Cloudflare Workers — `www.garageapothecary.com/soccer-fantasy`

**Last verified:** 2026-06-08 · **Workers:** `soccer-fantasy` (app) + `soccer-fantasy-cron` (scheduler)

Two Workers run this app:

| Worker | Source | Role | Deploy |
|---|---|---|---|
| `soccer-fantasy` | repo root (`wrangler.toml`, OpenNext build) | Next.js app + all `/api/*` routes | CI on push to `main`, or `npm run pages:build && npx wrangler deploy` |
| `soccer-fantasy-cron` | `cron-worker/` | Calls the app's API routes on a schedule | CI on push to `main`, or `cd cron-worker && npx wrangler deploy` |

CI (`.github/workflows/deploy.yml`) test-gates (`npm test`) then deploys **both** Workers, injecting the `/soccer-fantasy` basePath at build. **Secrets are NOT set by CI** — they are set once per Worker with `wrangler secret put` and persist across deploys. That manual, drift-prone step is what this runbook makes verifiable (blocker **B3**).

---

## Step 1 — Set the app Worker secrets

Set every secret below on the `soccer-fantasy` Worker. Each is read at runtime by `process.env`; if any **required** one is missing or a placeholder, the routes that use it return **500/401** in production (`createAdminSupabaseClient()` throws on a missing/placeholder service key; `isCronOrAdmin` can't match a bearer without `CRON_SECRET`).

```bash
cd soccer-fantasy-game

# Required (admin / cron / scoring / join routes 500 without these)
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL        # https://vgguaeutmljgvxdcfmkd.supabase.co
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY   # sb_publishable_… (publishable/anon key)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY       # sb_secret_…  (Supabase -> Settings -> API -> service_role / secret key)
npx wrangler secret put FOOTBALL_DATA_API_KEY           # football-data.org token (fixtures + live scores)
npx wrangler secret put CRON_SECRET                     # openssl rand -hex 32  — MUST equal the cron worker's CRON_SECRET

# Optional (only the daily reminder email needs these)
npx wrangler secret put RESEND_API_KEY                  # re_…  (resend.com)
npx wrangler secret put RESEND_FROM_EMAIL               # noreply@yourdomain.com
npx wrangler secret put NEXT_PUBLIC_APP_URL             # https://www.garageapothecary.com/soccer-fantasy  (MUST include the basePath)
```

> **Why `NEXT_PUBLIC_*` must be set on the Worker too.** Next inlines `NEXT_PUBLIC_*` into the client bundle at **build** time, but server components and API routes read `process.env` at **runtime on the Worker**. `wrangler.toml` declares no `[vars]`, so these must exist as Worker secrets/vars or the server-side Supabase client is unconfigured.

> **Service-role key format.** The app accepts either the new `sb_secret_…` key or a legacy `eyJ…` JWT. A value starting with `PASTE_` (or the `.env.example` placeholder) is treated as **missing** and throws on first admin/cron call.

---

## Step 2 — Set the cron Worker secrets

```bash
cd cron-worker
npx wrangler secret put APP_URL        # https://www.garageapothecary.com/soccer-fantasy  (INCLUDE /soccer-fantasy or every call 404s)
npx wrangler secret put CRON_SECRET    # EXACT same value as the app worker's CRON_SECRET
```

A `CRON_SECRET` mismatch makes every scheduled call **401**; `APP_URL` without `/soccer-fantasy` makes every call **404** (the Worker logs a warning for this case).

---

## Step 3 — Verify the secrets are actually wired

**3a. List secret names on each Worker** (names only, never values):

```bash
npx wrangler secret list --name soccer-fantasy
npx wrangler secret list --name soccer-fantasy-cron
```

**3b. Runtime readiness probe** (`/api/health` — confirms each secret is present **and** valid-looking, without revealing values):

```bash
curl -s -X POST https://www.garageapothecary.com/soccer-fantasy/api/health \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
```

`{"ok": true, "missingRequired": [], ...}` ⇒ the app Worker is fully configured. Any name in `missingRequired` is unset or a placeholder — fix it with the matching `wrangler secret put` and re-run. (If `CRON_SECRET` itself is unset you can't use the bearer; open `/api/health` while signed in as an admin instead.)

---

## Step 4 — Confirm both deployed Workers are current

```bash
git log -1 --format='%h %ci %s'      # the commit CI last deployed
git status -s                        # uncommitted changes are NOT deployed until pushed
```

Then in the Cloudflare dashboard → **Workers & Pages**, check `soccer-fantasy` and `soccer-fantasy-cron` **Last modified** ≥ your last `main` push, and `soccer-fantasy-cron` → **Triggers** shows the three crons below.

> **Cleanup — delete the pre-rebrand Workers.** The account still has `wcfantasy` and `wcfantasy-cron` (the old build). They are not referenced by any current `wrangler.toml`. Delete once `soccer-fantasy*` is confirmed healthy: `npx wrangler delete --name wcfantasy` / `--name wcfantasy-cron`.

---

## Cron schedules (`cron-worker/wrangler.toml` → `src/index.ts`)

| Cron (UTC) | Steps (run in order) | Purpose |
|---|---|---|
| `*/5 * * * *` | `sync-scores` → `score-picks` | Live/finished scores, then score newly-finished picks |
| `0 */6 * * *` | `sync-fixtures` → `derive-results` → `score-bracket` | Knockout fixtures, derive real results, rescore brackets |
| `0 18 * * *` | `notify-picks-reminder` | Daily reminder email (needs `RESEND_*`) |

> ⚠️ Earlier revisions listed `*/15 sync-scores` and `*/10 score-picks` — stale. The schedules above are authoritative.

---

## Step 5 — Data

Teams + the 72 group fixtures are seeded via `seed-teams` / `sync-fixtures`. Knockout `matches` rows only appear once the real group stage finishes and `sync-fixtures` resolves their teams — see `2026-06-08-knockout-bracket-readiness.md` for the full knockout/bracket data path (blocker **B4**).

---

## Local `.env.local` hygiene (does not affect the deployed Worker)

Never copy `.env.local` into a Worker secret: it sets `NEXT_PUBLIC_APP_URL` to the old `/worldcup2026` basePath and carries placeholder `SUPABASE_SERVICE_ROLE_KEY` / `RESEND_API_KEY`. Source real values from the Supabase and Resend dashboards.
