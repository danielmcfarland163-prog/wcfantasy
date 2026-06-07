# Phase 0 — Ship Runbook (git → deploy → secrets)

**Created:** 2026-06-06
**Why:** The automation/realtime/live fix wave is written in the working tree but **uncommitted and unshipped**. The deployed app worker is built from a pre-fix commit; the deployed cron worker (`wcfantasy-cron`) dates to Jun 5 (pre-rewrite). This runbook ships it. Steps 1, 3, 5–8 **must run on your machine / Cloudflare** — they need your secret values, a healthy local git, and a production deploy, none of which can be done from the audit sandbox.

> Status of adjacent items at time of writing (verified):
> - ✅ **Uruguay dedupe already done** — `teams` = 48, no duplicate, surviving row has group H + api_id 758. No action.
> - ◻️ **`is_league_member` hardening** — do **not** blanket-`REVOKE EXECUTE` (5 RLS policies depend on it). Safe migration is in §9.
> - ◻️ **Tests + CI test gate** — Vitest suite added under `tests/`; `deploy.yml` now runs `npm test` before deploy. Run it locally first (Step 2).

---

## 1. Verify / repair git (local)

The audit sandbox reported `error: improper chunk offset(s)` from git — that may be a sandbox artifact, but confirm your real repo is healthy before committing.

```powershell
cd C:\Users\danie\Documents\Claude\Projects\Games\worldcup-fantasy
git fsck --full
git status
```

If `fsck` reports corruption:

```powershell
# 1) Try a repack/gc first
git gc --prune=now
git fsck --full

# 2) If still broken, recover the working tree from the backup tarball,
#    re-clone a clean copy from the remote, and copy the working files over.
#    (The tarball in the repo root is a worktree snapshot.)
#    tar -xzf recovery-backup-worktree-2026-06-06.tgz -C <safe-temp-dir>
```

Do not proceed to commit until `git fsck` is clean.

## 2. Install, test, build (local)

```powershell
npm install            # reconciles package-lock.json (vitest was added)
npm test               # Vitest — scoring + bracket-scoring unit tests must pass
npm run pages:build    # confirms the OpenNext → Workers build is clean
```

All three must succeed before shipping. (The audit could not run these against the true tree from its sandbox.)

## 3. Commit the fix wave (local)

The following are uncommitted. Confirm with `git status`, then stage + commit.

New (untracked): `src/app/api/sync-fixtures/route.ts`, `src/components/RealtimeRefresh.tsx`, `src/lib/api-auth.ts`, `tests/`, `vitest.config.ts`, `.github/workflows/test.yml`, and the new `docs/` reports.
Modified: `cron-worker/src/index.ts`, `cron-worker/wrangler.toml`, `.github/workflows/deploy.yml`, `package.json`, `package-lock.json`, `src/app/api/{sync-scores,score-picks,...}/route.ts`, `src/app/{today,live,stats}/page.tsx`, `src/app/leagues/[id]/LeagueClient.tsx`, GDD/CHANGELOG.

```powershell
git add -A
git commit -m "feat: live sync + realtime + cron automation; tests + CI gate"
```

## 4. GitHub Actions repo secrets (one-time)

`Settings → Secrets and variables → Actions`. Required by `deploy.yml`:

- `CLOUDFLARE_API_TOKEN` — token with Workers Scripts:Edit on the account
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(`NEXT_PUBLIC_APP_URL` is hardcoded in the workflow to the basePath URL.)

## 5. App worker runtime secrets — `wcfantasy` (one-time)

`NEXT_PUBLIC_*` are inlined at build, but the **server-only** vars must exist as Worker secrets or the API routes 500 at runtime. Values are in your `.env.local`.

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put FOOTBALL_DATA_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
# (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are build-time; no secret needed)
```

## 6. Cron worker — `wcfantasy-cron` (one-time secrets, then it deploys via CI)

The cron worker calls the app's API routes on a schedule. It needs the app URL **including the `/worldcup2026` basePath** (omitting it makes every call 404 — the worker logs a warning if so) and the matching `CRON_SECRET`.

```powershell
cd cron-worker
npx wrangler secret put APP_URL          # https://www.garageapothecary.com/worldcup2026
npx wrangler secret put CRON_SECRET      # MUST equal the app's CRON_SECRET (Step 5)
cd ..
```

Schedules now wired (`cron-worker/src/index.ts` + `wrangler.toml`):
`*/5` → sync-scores → score-picks · `0 */6` → sync-fixtures → score-bracket · `0 18` → notify-picks-reminder.

## 7. Deploy

```powershell
git push origin main
```

CI now (a) runs `npm test`, (b) builds, (c) deploys the **app worker**, then (d) deploys the **cron worker** (newly added). Watch the Actions run to green.

## 8. Post-deploy verification

```powershell
# Routes require the cron bearer; expect 200 + JSON, not 401/404.
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" https://www.garageapothecary.com/worldcup2026/api/sync-scores
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" https://www.garageapothecary.com/worldcup2026/api/score-picks
```

Then confirm: a live/finished match write updates the `matches` row; `/today` and `/live` reflect it without a manual refresh (realtime); and the Cloudflare dashboard shows scheduled invocations on `wcfantasy-cron`.

## 9. Optional hardening (safe `is_league_member` fix)

Do **not** `REVOKE EXECUTE` — it breaks 5 RLS policies. Instead move the function out of the PostgREST-exposed `public` schema so it can't be called via `/rpc/`, while policies still reference it. Review, then apply as a migration:

```sql
create schema if not exists private;
alter function public.is_league_member(uuid) set schema private;
-- Update the 5 policies (chat_messages x2, league_members, league_scores, leagues)
-- to call private.is_league_member(...) instead of the public name.
```

Also enable **Leaked Password Protection** in the Supabase dashboard (Auth → Policies) — not exposed via API.

---

### Out of scope for Phase 0 (tracked in the gap report)
Tournament bonus picks (unbuilt), `/join/[code]` route + a real `/leaderboard`, league privacy/max-members controls, stats depth, knockout fixtures (run `sync-fixtures` after the real draw).
