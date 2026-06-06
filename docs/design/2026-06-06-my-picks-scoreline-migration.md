# My Picks — Scoreline + Confidence Migration

**Date:** 2026-06-06
**Feature:** Match Picks Core (My Picks) — DEPLOYMENT-PLANS.md #2
**Status:** Implemented

---

## Summary

The shipped `/picks` feature used an interim **1X2 winner-pick** model (pick HOME / DRAW / AWAY,
+1 pt for a correct result). The GDD (§2.1) and the database schema had already moved to the
target **exact-scoreline + confidence** model, but the UI, shared types, and the wired server
scorer hadn't been migrated. This change closes that gap.

The pure scoring library (`lib/scoring.ts`) and the `picks` table already matched the target
model, so no schema migration was required — the work was UI + types + re-wiring the scorer.

## Scoring model (GDD §2.1)

| Outcome | Base | With confidence |
|---|---|---|
| Wrong outcome | 0 | 0 |
| Correct outcome (W/D/L) | 3 | 3 × multiplier |
| Exact score | 5 (3 + 2 bonus) | 5 × multiplier |

Confidence multiplier ∈ {1×, 2×, 3×}. Result badge: **EXACT / CORRECT / WRONG**.
Values come from the `scoring_config` table (`correct_result_pts=3`, `exact_score_bonus=2`).

## What changed

- **`src/components/MatchCard.tsx`** — rebuilt: two tap-friendly score steppers (0–20), a
  1×/2×/3× confidence selector, Save/Update with saved + error states, a live-score view, a
  locked state (lock icon, read-only "your pick"), and the EXACT/CORRECT/WRONG result badge
  with points earned. Light theme, mobile-first, reuses the existing CSS-variable design system.
- **`src/app/picks/PicksClient.tsx`** — upserts `home_score_pick` / `away_score_pick` /
  `confidence_multiplier` (plus a derived `winner_pick` for back-compat); progress counters key
  off pick-row presence; filters are **Upcoming / Live / All** (Results appears once scored);
  added a **Supabase realtime subscription on `matches`** so live scores/status update in place.
- **`src/lib/types.ts`** — `Pick` carries the scoreline fields; `PickResult` gains `EXACT`;
  `winner_pick` kept optional/derived. Added `ConfidenceMultiplier = 1 | 2 | 3`.
- **`src/lib/score-utils.ts`** (`scorePicks`) — re-wired to `lib/scoring.ts` (0/3/5 × multiplier,
  EXACT/CORRECT/WRONG), writes `points_earned` + `pick_result`, and re-aggregates
  `picks_points` / `picks_correct` / `exact_scores` / `total_points` into `global_scores` and
  `league_scores`. Idempotent.
- **`src/app/picks/page.tsx`** — "picks made" counts pick rows rather than the legacy `winner_pick`.

## Verification

- Unit test over the real `scorePick` / `previewPickPoints` / `getMatchResult` (11/11), covering
  the spec cases (2-1 @2× → EXACT +10; correct outcome → 3; wrong → 0; exact draws; 3× cases).
- `matches` confirmed present on the `supabase_realtime` publication (live updates fire).

## Data notes & follow-ups

- The 144 existing picks are **legacy 1X2 test data** (scorelines default to 0–0). Re-run the
  admin **reset → simulate** flow to regenerate scored results under the new model, or simply make
  fresh scoreline picks.
- **Knockout fixtures (R32–Final) aren't seeded** — teams are unknown until the group stage ends
  (owned by the Bracket feature), so `/picks` shows the 12 group sections for now; knockout
  sections render automatically once those matches exist.
- `league_scores` is still single-column (`total_points`); true **dual-mode** picks/bracket league
  standings are tracked separately as DEPLOYMENT-PLANS.md #4.
- Minor data hygiene: `teams` has a stray `URY` row (no group) alongside `URU` (Group H) — unused
  by matches; worth cleaning up during a teams pass.
