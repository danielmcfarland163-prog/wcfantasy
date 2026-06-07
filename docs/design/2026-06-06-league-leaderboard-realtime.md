# League Leaderboards — Dual-Mode + Realtime

**Date:** 2026-06-06
**Area:** `src/app/leagues/[id]/`, `src/components/ui/LiveDot.tsx`, `src/lib/score-utils.ts`
**Status:** Implemented

## Summary

The league page (`/leagues/[id]`) now renders **independent, live-updating standings** for each
game mode, with sort/filter, per-mode KPIs, a members roster, and commissioner tools. It builds on
the existing dual-mode `league_scores` schema (see `2026-06-06-dual-mode-league-scores.sql`); this
pass adds the realtime, interaction, and presentation layers the original server-rendered page lacked.

## Data flow

```
score-picks / score-bracket (API or simulate)
        │  upsert picks_points / bracket_points / bracket_correct
        ▼
  league_scores  ──(supabase_realtime publication, already enabled)──►  client
        │                                                                  │
  recalculate_league_rankings(league_id)                                   │ postgres_changes (event:*, filter league_id)
  → picks_rank / bracket_rank / *_rank_change                              ▼
                                                          LeagueClient re-fetches + re-ranks, flashes changed rows
```

- **Initial paint:** `page.tsx` server-fetches `league_scores` (+ `profiles`) and the member roster,
  so the board is correct on first render (no loading flash, SSR-friendly).
- **Updates:** `LeagueClient` subscribes to `league_scores` filtered by `league_id` (same channel
  pattern as `LeagueChat`). On any change it re-queries the joined rows and diffs point totals against
  the previous snapshot to decide which rows to pulse. A green **LIVE** chip reflects channel status.
- **Ranking is computed client-side** (competition ranking, ties share a rank) from the active tab's
  points. This keeps the displayed rank consistent through live updates and across the Combined tab
  (which has no server-side rank column). Server `*_rank_change` values drive the ▲/▼/— trend chip.

## UI structure

- **Tabs** derived from `league.game_mode`: `both → [My Picks, Bracket]`, `combined → [+ Combined]`,
  single modes → one view, no tab bar.
- **Controls:** name search + sort (Rank / Pts / Name). Default view (`rank`, no query) shows the
  **podium** (top 3) above the table; any sort/filter collapses to the full table so nothing hides.
- **Table** (horizontally scrollable < 320px): `# · Player (avatar + name + trend) · KPI · PTS`.
  KPI per mode — Picks: exact (+correct); Bracket: correct; Combined: `picks·bracket`.
- **Members** roster (join date, 👑 Commissioner / YOU badges) + commissioner-only invite card.

## Decisions

- **Re-fetch on change** rather than patching from the realtime payload: payloads omit the `profiles`
  join, leagues are small, and a full re-query is simplest and always consistent.
- **Added `league_scores.bracket_correct`** so the Bracket tab has a real KPI symmetric with Picks.
  Bracket entries are global per user, so existing rows backfill from `global_scores.bracket_correct`;
  `scoreBrackets` writes it going forward.
- **Kept the podium** as a visual hero but made it yield to the table under active sort/filter — the
  spec's "table with columns + rank change" lives in the table; the podium is polish on top.

## Verification

- Migration `add_bracket_correct_to_league_scores` applied to project `vgguaeutmljgvxdcfmkd`
  (additive column + backfill); `league_scores` confirmed on the `supabase_realtime` publication.
- Source changes verified via file review. **Note:** in this session the Linux sandbox mount served
  stale/truncated copies of files edited through the editor, so `tsc`/`next build` could not be run
  against the live files from the sandbox — run `npm run build` locally to typecheck before deploy.

## Manual test script (from the deployment prompt)

1. Commissioner creates league "The Lads"; add 3 members.
2. Score a match → Picks tab shows ranked members with points + exact/correct KPI.
3. Score another match (only one member's picks land) → board updates within ~2s, no reload; the
   changed row pulses and its ▲/▼ trend updates.
4. Switch to Bracket tab → independent ranking + correct-count KPI.
5. Sort by Name / search a player; on mobile the table scrolls horizontally (page does not).
