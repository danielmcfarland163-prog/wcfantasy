-- =============================================
-- MIGRATION: add_bracket_correct_to_league_scores
-- Applied 2026-06-06 to project vgguaeutmljgvxdcfmkd (World Cup Pick'Em)
-- =============================================
-- Context: the league leaderboard's Picks tab shows a KPI (exact_scores /
-- correct_results) sourced from league_scores, but the Bracket tab had no
-- equivalent per-member KPI — league_scores tracked bracket_points only.
--
-- This adds league_scores.bracket_correct so the Bracket tab can render a
-- "Correct" KPI column. A user's bracket is global (one entry per user, scored
-- identically across every league they belong to), so existing rows are
-- backfilled from global_scores.bracket_correct. The scoring engine
-- (src/lib/score-utils.ts → scoreBrackets) now writes this column on every run.

ALTER TABLE league_scores
  ADD COLUMN IF NOT EXISTS bracket_correct INTEGER DEFAULT 0;

UPDATE league_scores ls
SET bracket_correct = gs.bracket_correct
FROM global_scores gs
WHERE gs.user_id = ls.user_id
  AND COALESCE(gs.bracket_correct, 0) > 0;
