# World Cup Fantasy — Product Design Document

**Version:** 0.2  
**Last Updated:** 2026-06-05  
**Platform:** Web (mobile-first)  
**Stack:** Next.js, TypeScript, Tailwind CSS, Cloudflare Workers, Supabase

---

## 1. Concept

A mobile-first World Cup companion app delivering the full tournament experience — real-time scores, rich statistics, bracket tracking, and social engagement — from group stage through the final.

See [`design/world-cup-app-design-prompt.md`](design/world-cup-app-design-prompt.md) for the original design brief.

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
- Tournament picks (champion, runner-up, golden boot) lock after the group stage ends

**Scoring:**

| Result | Base Points | With Multiplier |
|--------|------------|-----------------|
| Wrong outcome | 0 | 0 |
| Correct outcome (W/D/L) | 3 | 3 × multiplier |
| Exact score | 5 (3 + 2 bonus) | 5 × multiplier |

**Tournament bonus picks (one-time, locked after group stage):**

| Pick | Points |
|------|--------|
| Correct champion | 10 |
| Correct runner-up | 5 |
| Correct golden boot | 5 |

**Maximum possible points:** 80+ matches × 5pts × 3× multiplier + 20 tournament bonus = 1,220 pts theoretical max.

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

### 3.2 Dual-Mode Leaderboards

Each league shows **two leaderboard tabs** — one per game mode. They are independent; a user's rank in one tab has no bearing on the other.

```
League: "The Lads ⚽"
┌─────────────┬──────────────┐
│  My Picks   │   Bracket    │
└─────────────┴──────────────┘
  # Player      Pts   Exact
  1 Dan        142    8
  2 Alex       138    7
  ...
```

**Schema:** `league_scores` stores `picks_points` and `bracket_points` as separate columns. Each has its own `rank` and `rank_change` pair. See [`../deployment/schema-dual-mode.sql`](deployment/schema-dual-mode.sql) for the migration.

### 3.3 Global Leaderboard

`/leaderboard` shows global rankings across all users, also split into two tabs by mode.

### 3.4 Standings Update Triggers

| Event | Action |
|-------|--------|
| Match finishes | `api/score-picks` runs → updates `picks.points_earned` → recalculates `league_scores.picks_points` + `global_scores` |
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
| Live scores | `api/sync-scores` cron → football-data.org |
| Scoring | `api/score-picks`, `api/score-bracket` (triggered post-match) |

---

## 7. Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| v0.1 | Bracket HTML prototype | Archived |
| v0.2 | Next.js app scaffold + schema | Complete |
| My Picks core | Scoreline + confidence predictions, locking, live scoring, result badges | Complete (2026-06-06) |
| Bracket core | Sequential picker, lock + 24h countdown, submit confirmation, spec scoring, reviewer | Complete (2026-06-06) |
| v0.3 | Dual-mode league standings schema | Complete (2026-06-06) |
| v1.0 | Full tournament launch | Pending |
