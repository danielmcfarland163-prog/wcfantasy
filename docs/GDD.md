# Soccer Fantasy Game — Product Design Document

**Version:** 0.5  
**Last Updated:** 2026-06-08  
**Platform:** Web (mobile-first)  
**Stack:** Next.js, TypeScript, Tailwind CSS, Cloudflare Workers, Supabase

---

## 1. Concept

A mobile-first soccer tournament companion app delivering the full tournament experience — real-time scores, rich statistics, bracket tracking, and social engagement — from group stage through the final.

See [`design/soccer-fantasy-app-design-prompt.md`](design/soccer-fantasy-app-design-prompt.md) for the original design brief.

---

## 2. Game Modes

There are two independent fantasy game modes. Users can play one or both. Leagues track each mode separately with two leaderboard tabs.

---

### 2.1 My Picks (Match Predictor)

Users predict the exact scoreline for every match before kickoff. Every match is worth the same — there is no confidence multiplier.

**How it works:**
- Predict home and away score for each match
- Picks lock at each match's kickoff time

**Scoring:**

| Result | Points |
|--------|--------|
| Wrong outcome | 0 |
| Correct outcome (W/D/L) | 3 |
| Exact score | 5 (3 + 2 bonus) |

**Maximum possible points:** every match predicted at the exact score — e.g. the 72 seeded group matches × 5 pts = 360 pts, before knockout fixtures are added post-draw.

**Results populate to:** `picks` table (per match), `global_scores`, `league_scores.picks_points`.

---

### 2.2 Bracket (Tournament Predictor)

The Bracket game has **two independent modes** — players can play either or both, and each is scored separately on the same point values (below). Both predict group 1st/2nd (×12) and the third-place qualifiers (8 of 12) up front; they differ in how the **knockout** is predicted and scored.

**Mode A — Up-Front Pick'em (survivor pool).** Fill the *entire* bracket before the tournament, but as a **survivor pool, not a matchup bracket**: from your 32 predicted qualifiers you select which **16 reach the Round of 16**, then **8** of those reach the QF, **4** the SF, **2** the Final, and **1** champion — each round a subset of the last. Picks are **independent of matchup** and scored by **set membership** (did a selected team actually reach that round), so a missed group pick can no longer cascade through a fixed bracket of matchups — it only costs the points for that one team. Everything locks as one snapshot at the first match kickoff (the *group lock*, June 11, 2026 15:00 UTC). Stored in the same `r32/r16/qf/sf/final` columns as **sets**; see `prunePickemSurvivors` / `toggleSurvivor` in `lib/bracket.ts`.

**Mode B — Bracket Reset.** *(Unchanged.)* Group 1st/2nd + third-place qualifiers are predicted up front and lock at the group lock. The knockout then **re-opens**, seeded from the **actual** Round of 32 (everyone fills out the same real bracket of matchup winners, scored by **bracket position**), and locks at the R32 kickoff (the *knockout lock*, June 28, 2026 19:00 UTC).

Lock times are configurable via `NEXT_PUBLIC_BRACKET_LOCK` (group) and `NEXT_PUBLIC_KNOCKOUT_LOCK` (knockout). Each mode is one row in `bracket_entries`, keyed by `(user_id, mode)`. Reset's knockout unlocks automatically once `tournament_results` shows all 12 groups decided and the 8 third-place qualifiers known (`groupResultsComplete()`); per-mode seeding + locks live in `src/lib/bracket.ts`. Server-side, the trigger `enforce_bracket_phase_locks` freezes group columns at the group lock for both modes, and knockout columns at the **group** lock for pickem / the **knockout** lock for reset.

**Scoring (per correct pick):**

| Round | Points |
|-------|--------|
| Group finish (1st/2nd correct) | 2 pts each |
| Correct 3rd-place qualifier | 2 pts |
| Round of 32 correct winner | 3 pts |
| Round of 16 correct winner | 5 pts |
| Quarter-final correct winner | 8 pts |
| Semi-final correct winner | 13 pts |
| Final correct winner (champion) | 21 pts |

> These exact values live in `src/lib/bracket-scoring.ts`, the single source of truth shared by `api/score-bracket` and the bracket UI. `scoreBracketEntry(entry, results, mode)` is **mode-aware**: `pickem` scores knockout picks by **set membership** (the team is anywhere in that round's actual advancer set), `reset` by **bracket position**. Both use the same point values and totals. Theoretical max = **231 pts per mode** (groups 48 · 3rd 16 · 16×3=48 · 8×5=40 · 4×8=32 · 2×13=26 · champion 21).

**Results populate to:** `bracket_entries` (one row per user **per mode**), `tournament_results` (admin-maintained actuals), and `global_scores` / `league_scores.bracket_points` — which hold the **sum of both modes** (Total = Picks + Pick'em + Reset). Per-mode points are shown in the bracket UI and the player summary; `scoreBrackets()` aggregates the two entries per user.

---

## 3. Leagues & Standings

### 3.1 Structure

- Any user can create a league and invite others via a unique invite code
- Leagues have a commissioner who manages settings
- Max 50 members per league (configurable)
- Public leagues are discoverable; private leagues require an invite code

### 3.2 League Standings (dual-mode, single table)

Each league shows **one standings table with three score columns per member — Picks, Bracket, and Total — sorted by the combined total.** The two modes are still scored independently (a strong bracket can't dilute a weak picks score and vice-versa); the table simply surfaces both at once instead of behind a tab switcher.

```
League: "The Lads ⚽"
  # Player     Picks  Bracket  Total
  1 Dan          142       25    167   ›
  2 Alex         138       19    157   ›
  ...
```

Tapping a row opens that member's read-only **player summary** (`/leagues/[id]/picks/[userId]`) — a Picks / Bracket tabbed view with their pick-by-pick scorelines (predicted vs. actual, Exact / Correct / Missed chips) and their full bracket with ✓/✗ vs. results. Another member's picks appear once the match is LIVE/FINISHED, and their bracket only after the knockout lock (admins can preview earlier).

**Schema:** `league_scores` stores `picks_points` and `bracket_points` as separate columns, each with its own `rank` / `rank_change` pair; `total_points = picks + bracket` is recomputed by `recalculate_league_rankings()`. See [`../deployment/schema-dual-mode.sql`](deployment/schema-dual-mode.sql) for the migration.

### 3.3 Global Leaderboard

`/leaderboard` shows global rankings across all users, also split into two tabs by mode.

### 3.4 Standings Update Triggers

| Event | Action |
|-------|--------|
| Match finishes | `api/score-picks` runs the set-based `public.score_picks()` RPC → scores `picks.points_earned` → rebuilds `league_scores.picks_points` + `global_scores` + ranks in one DB round-trip |
| Admin updates bracket results | `api/score-bracket` runs → updates `league_scores.bracket_points` + `global_scores` |
| Either score update | `recalculate_league_rankings()` called per affected league |

### 3.5 Realtime

`league_scores` is on the Supabase realtime publication. Standings update live in the UI without refresh.

---

## 4. User Flows

### Onboarding
1. Sign up / log in (Supabase Auth)
2. Choose a username
3. Land on Today tab — see upcoming matches
4. Prompted to make picks and/or fill bracket before lock

### Making Picks (My Picks)
1. Open a match card → enter home/away score → save
2. Picks editable until kickoff
3. Post-match: see result badge (EXACT / CORRECT / WRONG) and points earned

### Filling the Bracket
1. Go to `/bracket` and pick a mode — **Up-Front Pick'em** or **Bracket Reset** (toggle at the top; each is its own game with its own score).
2. **Pick'em:** predict groups + 3rd place, then narrow your 32 qualifiers down the survivor pool (16 → 8 → 4 → 2 → champion) — pick who *advances*, not who beats whom — before June 11; it all locks at the first kickoff.
3. **Reset:** pick groups + 3rd before June 11; after the group stage the knockout re-opens seeded from the real Round of 32 and locks June 28.
4. Each mode becomes read-only at its lock; scores populate as results come in.

### Leagues
1. Create a league or join via invite code
2. View two-tab leaderboard (Picks / Bracket)
3. Chat with league members in real time

---

## 5. Design Principles

- Mobile-first, fast, visually compelling
- Full tournament lifecycle coverage
- Real-time score and standings updates via Supabase realtime
- Picks lock cleanly — no ambiguity about when a pick is final

---

## 6. Technical Architecture

| Concern | Decision |
|---------|----------|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| Hosting | Cloudflare Workers via OpenNext |
| Database | Supabase (Postgres + RLS + Realtime) |
| Auth | Supabase Auth |
| Live scores | `api/sync-scores` (LIVE-aware) + `api/sync-fixtures` (knockout generation) ← football-data.org |
| Scoring | `api/score-picks` (set-based `score_picks()` RPC), `api/score-bracket` — shared values in `lib/bracket-scoring.ts` |
| Automation | Standalone `cron-worker/` Worker: `*/5` sync+score-picks, `0 */6` fixtures+score-bracket, `0 18` reminders |
| Testing | Vitest unit tests for the scoring engines; CI **Test** step gates the deploy |

---

## 7. Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| v0.1 | Bracket HTML prototype | Archived |
| v0.2 | Next.js app scaffold + schema | Complete |
| My Picks core | Scoreline predictions, locking, live scoring, result badges | Complete (2026-06-06) |
| Bracket core | Sequential picker, lock + 24h countdown, submit confirmation, spec scoring, reviewer | Complete (2026-06-06) |
| v0.3 | Dual-mode league standings schema | Complete (2026-06-06) |
| Live automation | Cron worker, LIVE sync, knockout fixtures, client realtime; tests + CI gate | Complete (2026-06-06) |
| Standings redesign | Picks/Bracket/Total table + tap-through player summaries; status-based picks visibility; set-based `score_picks()` RPC | Complete (2026-06-07) |
| Hardening & audit | Team dedupe (48), `score_picks()` locked to service_role, docs refresh, stale-file cleanup | Complete (2026-06-08) |
| v0.5 — format change | My Picks confidence multiplier removed (flat 0/3/5); **two bracket modes** — Up-Front Pick'em (self-seeded, single lock) + Bracket Reset (knockout re-seeded from real R32 after groups) | Complete (2026-06-08) |
| v1.0 | Full tournament launch (knockouts seeded post-draw, deploy verified) | Pending |
