# Soccer Fantasy Game — Changelog

---

## Unreleased

### Phase 1 hardening — server bracket lock, team dedupe, scoring tests (2026-06-06)

- **Server-side bracket lock.** `bracket_entries` RLS previously gated writes on a `locked` boolean the client never set — so edits were never actually blocked after the deadline, and entries never became visible to other league members (league Bracket Reviews only ever showed your own). Both policies now use real time logic against the **2026-06-11 15:00 UTC** lock: owners may write only while `now() < lock`; after lock, all entries are readable (Reviews populate). `service_role` (admin/scoring) bypasses RLS, so the engine and admin tools are unaffected. Migration `bracket_entries_time_based_lock`.
- **Deduplicated teams.** Removed the duplicate Uruguay row (the `seed-teams` `URU` vs football-data `URY` collision): kept the `api_id`-bearing row (referenced by 3 matches), set its group (`H`) + flag, dropped the orphan (brackets/results store team **names**, so nothing was repointed), and added a `teams_name_unique` index to prevent recurrence. `seed-teams` updated to `URY`. **Teams: 49 → 48.** Migration `dedupe_uruguay_add_team_name_unique`.
- **Unit tests + CI.** Added **Vitest** with **17 tests** covering `lib/scoring.ts` (0/3/5 × confidence, draws, summaries) and `lib/bracket-scoring.ts` (per-round point values, order-independent 3rd-place, partial-tournament scoring, perfect bracket = 231). New `npm test` script and a **Test** step in the deploy workflow (runs before build).
- **Security notes.** The `is_league_member` SECURITY-DEFINER advisor warning is **accepted, not "fixed"**: the function backs 5 RLS policies under the `public` role (including anon "public leagues readable"), so revoking `EXECUTE` — the advisor's suggestion — would break RLS for everyone; its `search_path` is already pinned and it only ever reveals the *caller's own* membership (uses `auth.uid()`). All four SECURITY-DEFINER functions already have pinned `search_path`. **Manual step (not script-configurable):** enable Supabase → Auth → leaked-password protection (HaveIBeenPwned).

### Live automation — cron, live-score sync, knockout fixtures, realtime wiring (2026-06-06)

Implements the gap report's **Phase 2 ("make it live")** critical path.

- **Cron worker rewritten** (`cron-worker/`). Previously only `*/15 → score-bracket` was mapped and the declared `*/10` trigger had no handler, so live-score sync, pick scoring, and reminders never ran on a schedule. Now each schedule runs an ordered step list:
  - `*/5 * * * *` → `sync-scores` then `score-picks` (pull live/finished scores, then score newly-finished picks)
  - `0 */6 * * *` → `sync-fixtures` then `score-bracket` (pick up knockout fixtures as they resolve, rescore brackets)
  - `0 18 * * *` → `notify-picks-reminder` (daily reminder email)
  - Calls are uniform `POST`s; a startup check warns if `APP_URL` is missing the `/soccer-fantasy` basePath (the previous silent-404 footgun).
- **`sync-scores` now captures LIVE matches.** `mapStatus` mapped in-play games to `SCHEDULED`, so the `/live` page was always empty; it now maps `IN_PLAY`/`PAUSED → LIVE` (and fetches the full competition, updating only in-play/finished/postponed rows).
- **New `/api/sync-fixtures`** — idempotent full-schedule sync that generates **knockout match rows (R32 → Final)** as the draw/results resolve them. Unlike the one-shot `bootstrap-matches`, it does **not** create team rows (the cause of the duplicate-team bug); it maps football-data team ids onto existing teams via `api_id` and skips fixtures whose teams are still TBD. Wired to the 6-hour cron and exposed as an admin **"Sync fixtures"** button.
- **Shared auth `lib/api-auth.ts` (`isCronOrAdmin`)** applied to `sync-scores`, `sync-fixtures`, `score-picks`, `score-bracket`, `seed-teams`, `notify-picks-reminder`. All now accept **both GET and POST**. This fixes the admin **"Sync live scores"** and **"Seed teams"** buttons, which previously returned 401 (they called CRON-secret-only routes with no header).
- **Client realtime wiring.** New `RealtimeRefresh` component (debounced `router.refresh()` on Supabase `postgres_changes`) added to `/live`, `/today`, the global board (`/stats`), and league standings (`league_scores`, filtered by league). The relevant tables were already on the `supabase_realtime` publication; only the client subscriptions were missing.
- **Fixes:** cron handler typed to `ScheduledController` (the previous `ScheduledEvent` never type-checked); `/today` "YOU" leaderboard highlight now works (`user_id` added to the select); removed dead `'FT'`/`'UPCOMING'` status branches on `/live` and `/today`; admin sync-scores result message updated to the new `{synced,live,finished}` shape.
- **Verification:** app `tsc --noEmit` and `cron-worker` `tsc --noEmit` both clean.
- **Deploy follow-ups (not code):** set runtime secrets on the app worker (`SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`, optional `RESEND_*`) and on the cron worker (`CRON_SECRET`, `APP_URL=https://www.garageapothecary.com/soccer-fantasy`); deploy `cron-worker/` via `wrangler deploy`. Still pending from Phase 1: dedupe the duplicate Uruguay rows (`URY`/`URU`).

### League Leaderboards — realtime, dual-mode standings, sort/filter (2026-06-06)

- **Live standings, no refresh.** `LeagueClient` now hydrates from the server then opens a Supabase realtime subscription to `league_scores` (filtered by `league_id`). When the scoring engine writes new totals, the board re-fetches and re-ranks in place; changed rows briefly pulse (`wc-flash`/`wc-flash-me`, reduced-motion aware) and a green **LIVE** chip shows the channel is connected. Same channel pattern as `LeagueChat`.
- **Dual-mode tabs** ("My Picks" / "Bracket", plus "Combined" for combined leagues). Each tab ranks independently; ranks are computed client-side (competition ranking with ties) so they stay correct through live updates. Tabs are derived from `game_mode` (single-mode leagues show one view).
- **Sort & filter.** Sort by Rank / Pts / Name and a name search box. The podium (top 3) shows in the default rank view; any sort/filter collapses to the full sortable table. Empty-state when a search matches no one.
- **KPI column per mode.** Picks → exact scores (+ correct results); Bracket → correct predictions; Combined → P·B split. Rank-change chips now render **▲ / ▼ / —** (flat included) on both the podium and the table.
- **Members & commissioner.** New Members roster (avatars, join date, 👑 Commissioner + YOU badges) sourced from a widened `page.tsx` fetch (`profiles` + `joined_at`), plus a commissioner-only invite/share card.
- **Schema:** migration `add_bracket_correct_to_league_scores` adds `league_scores.bracket_correct` (backfilled from `global_scores`); `scoreBrackets` now persists it. Mobile table scrolls horizontally below 320px. Recorded at `docs/deployment/2026-06-06-league-scores-bracket-correct.sql`.

### Bracket — spec scoring, dual-mode standings & lock UX (2026-06-06)

- **Corrected bracket scoring to match GDD §2.2.** The engine was awarding `2/1/1/2/4/6/8/15` (group 1st/2nd, 3rd, R32, R16, QF, SF, Final). It now awards the spec values **2 / 2 / 2 / 3 / 5 / 8 / 13 / 21** (231 max). Point values now live in a single source of truth, `lib/bracket-scoring.ts`, consumed by the server engine **and** the UI so they can never drift again.
- **Fixed the broken league Bracket leaderboard.** `league_scores` was missing the `picks_points` / `bracket_points` (+ rank) columns the UI already read, and `scoreBrackets` was writing bracket points into `total_points`, **clobbering each member's My Picks score**. Migration `dual_mode_league_scores` adds the per-mode columns and a dual-mode `recalculate_league_rankings()`; the engine now writes `bracket_points` only and the function recomputes `total_points = picks + bracket` and both rank columns. My Picks scores are preserved.
- `lib/score-utils.ts`: `scoreBrackets` rewired to `scoreBracketEntry()`; `scorePicks` now also writes `picks_points` to `league_scores`. Both remain idempotent (re-runs recompute identical totals).
- **Lock UX:** new `LockCountdown` component — a calm lock-date chip that escalates to a prominent amber **live HH:MM:SS countdown within 24h** of the June 11 15:00 UTC lock. Added a **Submit / "Lock in my bracket"** confirmation in the Summary (and a *Review & submit* CTA after the champion pick); auto-save is retained, and picks stay editable until the global lock.
- **Scoring transparency:** the Summary now shows a **per-round points breakdown** with a running total once results land; `BracketReviewer` member chips show **points** instead of raw correct/total; the hardcoded "+15 PTS" champion badges now read from `BRACKET_PTS.champion` (21).
- Recomputed live scores against the existing tournament results: bracket totals are now **19** and **25** (were 13 / 17); cross-checked by an independent SQL re-derivation. Migration recorded at `docs/deployment/2026-06-06-dual-mode-league-scores.sql`.

### My Picks — scoreline predictions & confidence (2026-06-06)

- Migrated the **My Picks** core feature from the interim 1X2 (winner) model to the GDD's **exact-scoreline + confidence** model. `MatchCard` now takes a home/away score via tap-friendly steppers, a 1×/2×/3× confidence selector, and a Save/Update action; picks stay editable until kickoff and lock automatically after.
- Scoring per GDD §2.1: **0** (wrong outcome) / **3** (correct outcome) / **5** (exact score), multiplied by the confidence multiplier. Post-match cards show an **EXACT / CORRECT / WRONG** badge with points earned.
- `lib/types.ts`: `Pick` now carries `home_score_pick`, `away_score_pick`, `confidence_multiplier`; `PickResult` gains `EXACT`; `winner_pick` retained (optional, derived from the scoreline on save) for back-compat.
- `lib/score-utils.ts` (`scorePicks`): rewired to the pure scoreline engine in `lib/scoring.ts`, writing `points_earned` + `pick_result` and re-aggregating `picks_points` / `picks_correct` / `exact_scores` / `total_points` into `global_scores` and `league_scores`. Idempotent (re-runs recompute identical totals).
- `picks/PicksClient.tsx`: scoreline upsert (with derived `winner_pick`), pick-presence-based progress counters, **Upcoming / Live / All** (+ Results) filters, and a **Supabase realtime subscription to `matches`** for live score/status updates.
- Notes: existing picks are legacy 1X2 test data (scorelines default 0–0); knockout fixtures aren't seeded yet (teams unknown pre-tournament — owned by the Bracket feature), so `/picks` shows the 12 group sections until then.

### Auth & onboarding (2026-06-05)

- End-to-end Supabase auth via `@supabase/ssr`: magic link (passwordless), plus email + password sign-in / sign-up.
- Modernized SSR cookie handling to the `getAll`/`setAll` API in `lib/supabase-server.ts` and `middleware.ts` for reliable session refresh across reloads.
- Fixed `/auth/callback` to exchange the OTP code for a session and route to onboarding (first login) or `/today`; invalid/expired links now bounce back to `/auth/login?error=link`.
- New post-signup onboarding at `/auth/onboarding` — username claim (with uniqueness handling) and optional password setup; stores `username`/`display_name` in `profiles` and flips an `onboarded` flag.
- `middleware.ts` now gates protected routes: unauthenticated → `/auth/login`, authenticated-but-not-onboarded → `/auth/onboarding`.
- Mobile logout via new `AccountMenu` in the Today header (desktop already had sign-out in `SideNav`).
- DB migration `auth_onboarding_flow`: added `profiles.onboarded`, an INSERT RLS policy (`auth.uid() = id`), a collision-safe `handle_new_user()` trigger, and backfilled existing users.

> ⚠️ Required Supabase config (Auth → URL Configuration): set **Site URL** to the deployed origin and add `<origin>/soccer-fantasy/auth/callback` to **Redirect URLs**. See `docs/architecture/AUTH.md`.

- Next.js + TypeScript + Tailwind app scaffold
- Cloudflare Workers deployment configured
- OpenNext adapter integrated

## [Archived] v0.1 — HTML Bracket Prototype

- Standalone `2026-soccer-fantasy-bracket.html` bracket viewer
- Archived to `archive/bracket/`
