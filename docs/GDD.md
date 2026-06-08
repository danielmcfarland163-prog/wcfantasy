# Soccer Fantasy Game — Product Design Document

**Version:** 0.4  
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

Users predict the exact scoreline for every match before kickoff, with an optional confidence multiplier.

**How it works:**
- Predict home and away score for each match
- Apply a confidence multiplier: 1×, 2×, or 3×
- Picks lock at each match's kickoff time

**Scoring:**

| Result | Base Points | With Multiplier |
|--------|------------|-----------------|
| Wrong outcome | 0 | 0 |
| Correct outcome (W/D/L) | 3 | 3 × multiplier |
| Exact score | 5 (3 + 2 bonus) | 5 × multiplier |

**Maximum possible points:** every match predicted at the exact score with a 3× multiplier — e.g. the 72 seeded group matches × 5 pts × 3× = 1,080 pts, before knockout fixtures are added post-draw.

**Results populate to:** `picks` table (per match), `global_scores`, `league_scores.picks_points`.

---

### 2.2 Bracket (Tournament Predictor)

Users fill out a complete tournament bracket before the first match kicks off. The bracket locks as a single snapshot.

**Lock time:** June 11, 2026 at 15:00 UTC (first match kickoff).

**Pick sequence:**
1. **Group stage** — pick 1st and 2nd place in each of 12 groups (A–L)
2. **Third-place qualifiers** — pick which 8 third-place teams advance (out of 12)
3. **Round of 32** — 16 knockout matches, pick winners
4. **Round of 16** — 8 matches
5. **Quarter-finals** — 4 matches
6. **Semi-finals** — 2 matches
7. **Final** — 1 match

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

> Implemented and verified (2026-06-06): these exact values live in `src/lib/bracket-scoring.ts`, the single source of truth shared by `api/score-bracket` and the bracket UI. Theoretical max = **231 pts** (groups 48 · 3rd 16 · R32 48 · R16 40 · QF 32 · SF 26 · Final 21).

**Results populate to:** `bracket_entries` (user bracket state), `tournament_results` (admin-maintained actuals), `global_scores`, `league_scores.bracket_points`.

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

Tapping a row opens that member's read-only **player summary** (`/leagues/[id]/picks/[userId]`) — a Picks / Bracket tabbed view with their pick-by-pick scorelines (predicted vs. actual, Exact / Correct / Missed chips, confidence multiplier) and their full bracket with ✓/✗ vs. results. Another member's picks appear once the match is LIVE/FINISHED, and their bracket only after the tournament lock (admins can preview earlier).

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
1. Open a match card → enter home/away score → set confidence → save
2. Picks editable until kickoff
3. Post-match: see result badge (EXACT / CORRECT / WRONG) and points earned

### Filling the Bracket
1. Go to `/bracket`
2. Complete groups → third-place qualifiers → knockout rounds sequentially
3. Submit before tournament lock (June 11)
4. Post-lock: bracket becomes read-only; scores populate as results come in

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
| My Picks core | Scoreline + confidence predictions, locking, live scoring, result badges | Complete (2026-06-06) |
| Bracket core | Sequential picker, lock + 24h countdown, submit confirmation, spec scoring, reviewer | Complete (2026-06-06) |
| v0.3 | Dual-mode league standings schema | Complete (2026-06-06) |
| Live automation | Cron worker, LIVE sync, knockout fixtures, client realtime; tests + CI gate | Complete (2026-06-06) |
| Standings redesign | Picks/Bracket/Total table + tap-through player summaries; status-based picks visibility; set-based `score_picks()` RPC | Complete (2026-06-07) |
| Hardening & audit | Team dedupe (48), `score_picks()` locked to service_role, docs refresh, stale-file cleanup | Complete (2026-06-08) |
| v1.0 | Full tournament launch (knockouts seeded post-draw, deploy verified) | Pending |
