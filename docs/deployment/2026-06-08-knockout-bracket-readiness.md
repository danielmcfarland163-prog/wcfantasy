# Knockout & Bracket Data Readiness (Blocker B4)

**Date:** 2026-06-08 · **DB:** Supabase `vgguaeutmljgvxdcfmkd` ("Soccer Cup Pick'Em") · **Depends on:** B3 (worker secrets)

## TL;DR

B4 as originally written — *"run `sync-fixtures` after the draw; verify `score-bracket` on the `0 */6` tick"* — is **necessary but not sufficient**. Investigating the live DB + code surfaced two deeper gaps that would make a real tournament silently mis-score. This doc records the corrected diagnosis, what was verified, and the production pipeline that now closes it.

## Current live state (verified 2026-06-08)

| Fact | Value |
|---|---|
| `matches` | 72 GROUP, **0 knockout** rows |
| `tournament_results` r32…final | empty until real knockout matches resolve |
| Bracket scoring math | verified correct (perfect = 231, empty = 0, partials exact) |
| Group picks scoring | works end-to-end |

The real 2026 WC's first kickoff is 2026-06-11, so football-data.org still lists every match as `SCHEDULED` with **TBD knockout teams**.

## Why there are 0 knockout rows (the part B4 already named)

`sync-fixtures` only inserts a knockout `matches` row once **both** teams resolve to a seeded `api_id` (it skips TBD fixtures). football-data.org won't fill knockout teams until the **real** group stage finishes (~2026-06-24/26). So knockout rows appear automatically on the `0 */6` cron then — no code change needed for that part — and simulated standings never feed `sync-fixtures` (it reads the live API).

## The two gaps B4 did NOT name (found this pass)

### Gap 1 — `tournament_results` had no production writer 🟠
`score-bracket` → `scoreBrackets()` reads **only** `tournament_results` + `bracket_entries`; it never looks at `matches`. The **only** code that wrote `tournament_results` was the admin **simulator**. So in production, `sync-fixtures` could seed every knockout match and `score-bracket` would still award **0 bracket points forever**, because `r32_results…final_result` stay empty. The `0 */6` tick ran without error while scoring nothing.

### Gap 2 — knockout winners can't be derived from the old schema 🟠
A correct `r32…final` needs the **winner** of each knockout match. Knockouts can be level after 90′ and decided in extra time / penalties. `matches` stored only `home_score`/`away_score` — no penalty/winner signal — so "winner = higher score" is wrong for any shootout.

### Minor — `reset` didn't clear knockout rows ⚪
`admin/simulate` `reset` only touched `stage=GROUP`, leaving dynamically-created knockout rows behind.

## What was verified ✅

- **Bracket scoring math is correct.** Compiled `lib/bracket-scoring.ts`: perfect bracket = **231**, empty results = **0** (no penalty for unplayed rounds), partial tournaments exact (groups+thirds+R32 = 112; half-R32 = 88).
- **Group picks scoring works** end-to-end on live data.
- **`derive-results` is unit-tested 8/8** incl. a full deterministic R32→Final walk and best-8 thirds tiebreak.

## Remediation

**✅ Path A implemented (2026-06-08).** Ships in:
- `migrations/2026-06-08_add_match_winner.sql` — adds `matches.winner_team_id` (applied live).
- `src/app/api/sync-scores/route.ts` — records the knockout winner from `score.winner` (ET/penalty-safe).
- `src/lib/derive-results.ts` — pure `computeTournamentResults()` (unit-tested, `tests/derive-results.test.ts`) + `deriveResults(supabase)`.
- `src/app/api/derive-results/route.ts` — auth-gated; inserted into the `0 */6` cron **before** `score-bracket` (`cron-worker/src/index.ts`).
- `src/app/api/admin/simulate/route.ts` — `reset` now deletes knockout rows + their picks.

**To activate:** run the migration on any other env, set B3 secrets, then `git push` (CI deploys both Workers — the cron worker must redeploy to pick up the new step). Then the `0 */6` tick runs sync-fixtures → derive-results → score-bracket end-to-end. Until real knockout matches finish, `derive-results` simply recomputes group standings and leaves knockout slots null (harmless no-op).

**Path B — test the knockout flow now (pre-tournament).** To exercise **knockout scoreline picks** before real fixtures exist, seed R32 `matches` from the current simulated standings with `seed-r32-knockouts.sql` (same folder). Reversible (cleanup block included); `api_match_id = NULL` so a later real `sync-fixtures` won't collide. To verify `score-bracket` end-to-end, run the admin simulator's **bracket**/**full** action, then confirm `global_scores.bracket_points > 0`.

## Trigger checklist (when the real tournament runs)

- [ ] Real group stage finishes → `sync-fixtures` (`0 */6`) seeds knockout `matches` automatically.
- [x] Path A built (2026-06-08) → `derive-results` populates `tournament_results` from real outcomes. *(deploy: migration + push so the cron worker picks up the new step)*
- [ ] `score-bracket` (`0 */6`) yields non-zero `bracket_points`; spot-check one entry against the on-screen breakdown.
- [ ] Test-only R32 rows from Path B removed.
