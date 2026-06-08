# Deploy: two bracket modes + confidence removal (2026-06-08)

Two product/format changes ship together. Both are backward-compatible at the data
layer (no destructive column drops); the work is two SQL migrations
(`drop_confidence_from_score_picks` + `bracket_two_modes`), one new env var, and the
app code.

## 1. My Picks — confidence multiplier removed

Every match is now a flat **0 / 3 / 5** (wrong / correct outcome / exact score).

- **Migration:** `migrations/2026-06-08_drop_confidence_from_score_picks.sql`
  re-issues `public.score_picks()` without the `* confidence_multiplier` factor.
- **Column kept:** `picks.confidence_multiplier` stays (defaults to `1`) so old rows
  and the insert payload remain valid — it simply no longer affects scoring.
- **Backfill (only if picks were already scored *with* a multiplier):** run the
  commented block at the bottom of the migration to null `scored_at` and re-score.

Apply:

```sql
-- Supabase SQL editor (or supabase db push)
\i migrations/2026-06-08_drop_confidence_from_score_picks.sql
SELECT public.score_picks();   -- rebuild standings at the flat values
```

## 2. Bracket — two independent modes

The Bracket game now has two modes (toggle on `/bracket`), each its own entry + score:

| Mode | What | Knockout seeded from | Locks |
|------|------|----------------------|-------|
| **Up-Front Pick'em** | whole bracket filled before kickoff | the player's **own** predicted groups | one lock at **2026-06-11 15:00 UTC** (`NEXT_PUBLIC_BRACKET_LOCK`) |
| **Bracket Reset** | groups + 3rd up front; knockout re-opens after the group stage | the **actual** R32 (`groupResultsComplete()`) | group cols at 06-11; knockout at **2026-06-28 19:00 UTC** (`NEXT_PUBLIC_KNOCKOUT_LOCK`) |

Reset's knockout is seeded from `tournament_results` (the actual winners / runners-up /
best-8 thirds), so every player fills out the **same** real Round of 32. It unlocks
automatically once `derive-results` has populated all 12 group results + the 8 thirds.

- **Migration:** `migrations/2026-06-08_bracket_two_modes.sql` — **supersedes**
  `2026-06-08_phased_bracket_locks.sql` (apply this one instead of that). It:
  - adds `bracket_entries.mode` (`pickem` | `reset`) and swaps the PK to
    `(user_id, mode)` — two rows per user;
  - widens the RLS **write** window to the knockout lock (the original policy blocked
    all writes after 2026-06-11, which would make reset's knockout picks unsavable);
  - makes trigger **`enforce_bracket_phase_locks`** mode-aware: group columns freeze at
    the group lock for both modes; knockout columns freeze at the **group** lock for
    pickem and the **knockout** lock for reset. Compares `NEW` vs `OLD`, so a save that
    re-sends unchanged columns is allowed; only an actual change to a frozen column is
    rejected.
- **Scoring:** `scoreBrackets()` sums each user's two entries into the combined
  `bracket_points` (Total = Picks + Pick'em + Reset). Per-mode points render in the UI.
- **Read visibility:** the player summary reveals each mode at its own lock — pickem at
  the group lock, reset at the knockout lock — so in-progress reset knockout picks
  aren't leaked. `service_role` (admin/scoring) bypasses RLS + the trigger.

Apply:

```sql
\i migrations/2026-06-08_bracket_two_modes.sql
```

### New env var

Set on **both** Workers (app + cron) alongside the existing `NEXT_PUBLIC_BRACKET_LOCK`.
`NEXT_PUBLIC_*` is inlined at build/runtime, so it must be present when the app Worker
runs.

```
NEXT_PUBLIC_KNOCKOUT_LOCK=2026-06-28T19:00:00Z
```

Defaults live in `src/lib/bracket.ts` (`GROUP_LOCK_ISO`, `KNOCKOUT_LOCK_ISO`), so the
app works without the var; set it only to override. **Keep the two migration
timestamps in sync with these env values** — the trigger and RLS use hard-coded
literals (Postgres can't read `NEXT_PUBLIC_*`).

## Rollout order

1. Apply both migrations on the target project — `drop_confidence_from_score_picks`
   and `bracket_two_modes` (the latter supersedes `phased_bracket_locks`; don't apply
   that one).
2. Set `NEXT_PUBLIC_KNOCKOUT_LOCK` on both Workers.
3. `git push` → CI builds + deploys both Workers.
4. Smoke-check: `/picks` shows no confidence selector; `/bracket` shows the **mode
   toggle** (Up-Front Pick'em / Bracket Reset). In Pick'em the Bracket tab opens once
   your own groups are complete; in Reset it stays gated ("opens after the group
   stage") until `tournament_results` is complete.

## Verify (post-tournament-sim)

- **Pick'em:** complete your 12 group picks → the Bracket tab unlocks immediately and
  is seeded from *your* predicted standings.
- **Reset:** admin simulator → run a full group stage → the Reset Bracket tab unlocks
  and its R32 matches the *actual* standings.
- Make a Reset knockout pick after `2026-06-11`; confirm it saves (write window
  extended) and that group picks can no longer be changed (trigger → `check_violation`).
- After scoring, `global_scores.bracket_points` equals the **sum** of a user's two
  modes; spot-check one entry against the on-screen per-mode breakdowns.
