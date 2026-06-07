# Soccer Fantasy Game — Rebrand & Slug Migration Runbook

**Created:** 2026-06-06
**Scope:** Rename the product *World Cup Fantasy → Soccer Fantasy Game*, migrate the URL slug `/worldcup2026 → /soccer-fantasy`, rename the project folder and Worker services, and scrub the archived bracket + design handoff. **All code/config/doc changes are already in the working tree.** This runbook covers the **manual infrastructure cutover** you must run on Cloudflare / Supabase / your machine, because it needs your credentials and a production deploy.

> ⚠️ Two breaking changes happen together here: the **basePath** changes every app URL, and the **Worker service is renamed** (a deploy creates a *new* Worker that starts with **no secrets and no routes**). Run this as one coordinated cutover, not piecemeal.

---

## What already changed in the repo

| Area | Old | New |
|---|---|---|
| Product name | World Cup Fantasy [2026] | **Soccer Fantasy Game** |
| Package name | `worldcup-fantasy` | `soccer-fantasy-game` |
| URL slug / `basePath` | `/worldcup2026` | `/soccer-fantasy` |
| App routes (`wrangler.toml`) | `garageapothecary.com/worldcup2026*` | `garageapothecary.com/soccer-fantasy*` |
| App Worker name | `wcfantasy` | `soccer-fantasy` |
| Cron Worker name | `wcfantasy-cron` | `soccer-fantasy-cron` |
| CI `NEXT_PUBLIC_APP_URL` | `…/worldcup2026` | `…/soccer-fantasy` |
| Project folder | `worldcup-fantasy/` | `soccer-fantasy-game/` |
| Design handoff | `World Cup 2026/` + `.zip` | `Soccer Fantasy Game/` + `.zip` |
| Archived bracket | `/worldcup`, worker `worldcup-2026`, `worldcup.html` | `/soccer-fantasy-bracket`, worker `soccer-fantasy-bracket`, `soccer-fantasy-bracket.html` |

**Deliberately left unchanged** (external identifiers we don't control by editing files):

- **Supabase project name** "World Cup Pick'Em" (`vgguaeutmljgvxdcfmkd`) — a dashboard label; rename it in the Supabase dashboard if you want.
- **football-data.org competition code** `WC` in `.env.example` — a real upstream API value.
- The **`.zip` snapshot's *internal* contents** — the archive file was renamed, but bytes inside it still reflect the old mockup names. Re-zip from `Soccer Fantasy Game/` if you need a clean archive.

---

## Cutover (run top to bottom)

### Step 1 — Deploy the renamed app Worker

```powershell
cd C:\Users\danie\Documents\Claude\Projects\Games\soccer-fantasy-game
npm install
npm run pages:build
npx wrangler deploy
```

Because `wrangler.toml` `name` is now `soccer-fantasy`, this **creates a brand-new Worker** `soccer-fantasy` and attaches the route `garageapothecary.com/soccer-fantasy*`. The old `wcfantasy` Worker still exists (with its old `/worldcup2026*` route) until Step 5.

### Step 2 — Set runtime secrets on the new `soccer-fantasy` Worker

Secrets do **not** carry over to a new Worker — the API routes will 500 until these exist. Values are in your `.env.local`.

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put FOOTBALL_DATA_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
```

### Step 3 — Deploy + configure the renamed cron Worker `soccer-fantasy-cron`

```powershell
cd cron-worker
npx wrangler deploy
npx wrangler secret put APP_URL        # https://www.garageapothecary.com/soccer-fantasy
npx wrangler secret put CRON_SECRET    # MUST equal the app's CRON_SECRET (Step 2)
cd ..
```

The cron Worker self-checks for `/soccer-fantasy` in `APP_URL` and logs a warning if the basePath is missing.

### Step 4 — Update Supabase Auth redirect URLs

**Supabase dashboard → Authentication → URL Configuration → Redirect URLs:**

- **Add:** `https://www.garageapothecary.com/soccer-fantasy/auth/callback`
- **Add (local dev):** `http://localhost:3000/soccer-fantasy/auth/callback`
- **Remove:** the two `…/worldcup2026/auth/callback` entries

Leave **Site URL** as the deployed origin. Sign-in 400s with a redirect mismatch until the new callback is allow-listed.

### Step 5 — Delete the old Workers

Once `soccer-fantasy` serves traffic correctly, delete the old services in **Cloudflare dashboard → Workers & Pages**:

- Delete **`wcfantasy`** — this also removes its `garageapothecary.com/worldcup2026*` routes.
- Delete **`wcfantasy-cron`**.

### Step 6 — (Recommended) 301 the old slug so bookmarks don't break

The old route is gone with the old Worker, so add a zone-level redirect instead. **Cloudflare → Rules → Redirect Rules → Create:**

- If URI path starts with `/worldcup2026`
- Then 301 → `https://www.garageapothecary.com/soccer-fantasy` + remaining path, preserve query string.

### Step 7 — Rename your local working copy

The repo folder is already `soccer-fantasy-game/` here. On any other machine / clone:

```powershell
Rename-Item "worldcup-fantasy" "soccer-fantasy-game"
```

CI is unaffected — `.github/` is at the repo root, so the GitHub remote and Actions checkout don't depend on the local folder name.

### Step 8 — (Optional) Legacy bracket Worker

The archived bracket config now targets Worker `soccer-fantasy-bracket` at `/soccer-fantasy-bracket`. If the old `worldcup-2026` Worker is still deployed at `/worldcup`, delete it (and its route). Note `…/soccer-fantasy*` is a prefix of `…/soccer-fantasy-bracket*`; Cloudflare routes the more-specific match to the bracket Worker, so deploy the bracket route too if you keep that page.

---

## Post-deploy verification

```powershell
# App serves at the new slug (expect 200):
curl.exe -I https://www.garageapothecary.com/soccer-fantasy

# Cron routes respond (expect 200 + JSON, not 401/404):
curl.exe -X POST -H "Authorization: Bearer <CRON_SECRET>" https://www.garageapothecary.com/soccer-fantasy/api/sync-scores
```

Then confirm: sign-in completes through `/soccer-fantasy/auth/callback`; the old `/worldcup2026` 301-redirects; and the Cloudflare dashboard shows scheduled invocations on **`soccer-fantasy-cron`** (not the deleted `wcfantasy-cron`).

## Rollback

The slug + names live in four places that must agree: `next.config.mjs` (`basePath`), `wrangler.toml` (`name`, `service`, routes), `.github/workflows/deploy.yml` (`NEXT_PUBLIC_APP_URL`), and the cron `APP_URL` secret. To roll back, revert the rebrand commit, `wrangler deploy`, re-add the `/worldcup2026*` routes and the old Supabase redirect URLs. (The old `wcfantasy` Worker is the clean rollback target **only if you haven't deleted it in Step 5** — consider keeping it until the new one is verified.)
