# Two bracket modes (Pick'em + Reset) and remove the My Picks confidence multiplier

**Date:** 2026-06-08 · **Area:** Bracket game, My Picks scoring · **DB migration:** yes

## Summary

Two format changes ship together:

1. **My Picks — confidence multiplier removed.** Every match is now a flat **0 / 3 / 5** (wrong / correct outcome / exact score). The 1×/2×/3× selector is gone.
2. **Bracket — two independent game modes.** `/bracket` now has a mode toggle:
   - **Up-Front Pick'em** — fill the entire bracket before the tournament; the knockout is seeded from your *own* predicted groups; one lock at the first kickoff (Jun 11).
   - **Bracket Reset** — predict groups + 3rd up front (lock Jun 11); the knockout then re-opens seeded from the *actual* Round of 32 and locks at the R32 kickoff (Jun 28).

   Each mode is its own game with its own picks and score. On the leaderboards the **Bracket** column is the sum of both (Total = Picks + Pick'em + Reset); per-mode points show on the bracket page and player summary.

## 1 · My Picks: no confidence multiplier

Scoring is now flat — `wrong = 0`, `correct outcome = 3`, `exact score = 5` — with no multiplier anywhere in the UI or scoring path.

- UI: removed the selector, the preview multiplier, the locked-pick badge, and the league member-view badge.
- `lib/scoring.ts` (`scorePick`, `previewPickPoints`, `scoreAllPicksForMatch`) and `scoring.test.ts` updated.
- `public.score_picks()` re-issued without the `* confidence_multiplier` factor.
- The `picks.confidence_multiplier` column is **kept** (defaults to `1`) for back-compat — it simply no longer affects scoring.

## 2 · Bracket: two modes

| Mode | Fill | Knockout seeded from | Lock(s) |
|------|------|----------------------|---------|
| **Up-Front Pick'em** | whole bracket, before kickoff | your **own** predicted groups | one lock — Jun 11 |
| **Bracket Reset** | groups + 3rd up front; knockout after the group stage | the **actual** R32 | groups Jun 11, knockout Jun 28 |

- `lib/bracket.ts` — mode layer (`BracketMode`, `BRACKET_MODES`, `bracketModeOpen`, `bracketModeLock`/`isBracketModeLocked`, `getModeMatchTeams`) on top of the phased helpers (`GROUP_LOCK`/`KNOCKOUT_LOCK`, `groupResultsComplete`, `knockoutFixturesFromResults`, `reconcileKnockout`). Pick'em reuses the classic `getMatchTeams` (own-group seeding); Reset uses `getKnockoutMatchTeams` (real-results seeding).
- `BracketModes` (new) — top-of-page toggle; mounts `BracketClient` keyed by mode so each game keeps its own state.
- `BracketClient` — branches seeding, the bracket-open gate, locks/banners, and the Summary submit affordance by mode; saves with `mode` (`onConflict user_id,mode`).
- `score-utils.ts` — `scoreBrackets()` sums each user's two entries into the combined `bracket_points`.
- Player summary — shows **both** modes, each revealed to other members at its own lock (Pick'em = group lock, Reset = knockout lock).

## Data model / migrations

Apply both, in order:

1. `migrations/2026-06-08_drop_confidence_from_score_picks.sql` — re-issues `score_picks()` (flat scoring). Then `SELECT public.score_picks();` to rebuild standings.
2. `migrations/2026-06-08_bracket_two_modes.sql` — adds `bracket_entries.mode`, swaps the PK to `(user_id, mode)`, widens the write window to the knockout lock, and makes the `enforce_bracket_phase_locks` trigger mode-aware. **Supersedes** `2026-06-08_phased_bracket_locks.sql` (do **not** apply that one).

**Env var** (both Workers): `NEXT_PUBLIC_KNOCKOUT_LOCK=2026-06-28T19:00:00Z`. Lock-date literals in the migration must stay in sync with `NEXT_PUBLIC_BRACKET_LOCK` / `NEXT_PUBLIC_KNOCKOUT_LOCK`.

Full runbook: `docs/deployment/2026-06-08-phased-bracket-and-no-confidence.md`.

## Reviewer notes / risk

- **PK change** on `bracket_entries` (→ composite). Existing rows backfill to `mode = 'pickem'`; the `profiles` FK on `user_id` is unaffected.
- **Order matters** — the app's bracket save uses `onConflict user_id,mode`, so the migration must land before the new client deploys, or saves error (handled with a toast, but picks won't persist).
- **Decision to confirm:** the two modes have **independent** group/3rd picks (you predict groups in each). Easy to switch to a single shared group prediction if preferred.
- Per-mode locks enforced server-side by the trigger (`check_violation`), so late edits can't slip past client gating.

## Testing

- Logic verified with standalone harnesses (29 assertions total): flat 0/3/5 scoring; R32 seeding order matching the production `derive-results` mapping; Pick'em seeds from own groups vs Reset from real results; per-mode open/lock gating; per-user score aggregation.
- Run `npm test && npm run build` locally as the final gate (the sandbox couldn't run the native toolchain).

## Files changed

**New**
- `src/app/bracket/BracketModes.tsx`
- `migrations/2026-06-08_bracket_two_modes.sql`
- `migrations/2026-06-08_drop_confidence_from_score_picks.sql`
- `migrations/2026-06-08_phased_bracket_locks.sql` *(superseded by `bracket_two_modes`)*
- `docs/deployment/2026-06-08-phased-bracket-and-no-confidence.md`

**Modified**
- `src/lib/bracket.ts`, `src/lib/scoring.ts`, `src/lib/scoring.test.ts`, `src/lib/score-utils.ts`
- `src/app/bracket/BracketClient.tsx`, `src/app/bracket/page.tsx`
- `src/components/MatchCard.tsx`, `src/app/picks/PicksClient.tsx`
- `src/app/leagues/[id]/picks/[userId]/page.tsx`
- `docs/GDD.md`, `docs/CHANGELOG.md`
