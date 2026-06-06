# World Cup Fantasy — Changelog

---

## Unreleased

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

> ⚠️ Required Supabase config (Auth → URL Configuration): set **Site URL** to the deployed origin and add `<origin>/worldcup2026/auth/callback` to **Redirect URLs**. See `docs/architecture/AUTH.md`.

- Next.js + TypeScript + Tailwind app scaffold
- Cloudflare Workers deployment configured
- OpenNext adapter integrated

## [Archived] v0.1 — HTML Bracket Prototype

- Standalone `2026-world-cup-bracket.html` bracket viewer
- Archived to `archive/bracket/`
