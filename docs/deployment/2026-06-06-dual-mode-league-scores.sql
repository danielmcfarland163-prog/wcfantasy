-- =============================================
-- MIGRATION: dual_mode_league_scores
-- Applied 2026-06-06 to project vgguaeutmljgvxdcfmkd (World Cup Pick'Em)
-- =============================================
-- Context: global_scores already carried picks_points / bracket_points, but
-- league_scores did not — so the league leaderboard's "Bracket" tab (which reads
-- league_scores.bracket_points) showed 0 for everyone, and api/score-bracket was
-- overwriting league_scores.total_points with bracket-only points, wiping each
-- member's My Picks contribution.
--
-- This migration adds the per-mode columns the UI already reads and replaces
-- recalculate_league_rankings() with a dual-mode version that ranks Picks and
-- Bracket independently. The scoring engine (src/lib/score-utils.ts) writes the
-- per-mode point totals directly (absolute, idempotent) and then calls this
-- function — so the delta-style helper RPCs are intentionally not used.

ALTER TABLE league_scores
  ADD COLUMN IF NOT EXISTS picks_points        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS picks_rank          INTEGER,
  ADD COLUMN IF NOT EXISTS picks_rank_change   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bracket_points      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bracket_rank        INTEGER,
  ADD COLUMN IF NOT EXISTS bracket_rank_change INTEGER DEFAULT 0;

-- Pre-migration rows tracked picks-only totals in total_points.
UPDATE league_scores
SET picks_points = total_points
WHERE COALESCE(picks_points, 0) = 0 AND COALESCE(total_points, 0) > 0;

CREATE OR REPLACE FUNCTION recalculate_league_rankings(p_league_id UUID)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  curr_picks_rank   INTEGER := 0;
  curr_bracket_rank INTEGER := 0;
BEGIN
  -- Picks ranks
  FOR r IN
    SELECT user_id, picks_rank AS old_rank
    FROM league_scores
    WHERE league_id = p_league_id
    ORDER BY COALESCE(picks_points, 0) DESC
  LOOP
    curr_picks_rank := curr_picks_rank + 1;
    UPDATE league_scores
    SET picks_rank        = curr_picks_rank,
        picks_rank_change = COALESCE(r.old_rank, curr_picks_rank) - curr_picks_rank,
        -- keep legacy single-mode columns in sync with the default (Picks) view
        rank              = curr_picks_rank,
        rank_change       = COALESCE(r.old_rank, curr_picks_rank) - curr_picks_rank
    WHERE league_id = p_league_id AND user_id = r.user_id;
  END LOOP;

  -- Bracket ranks
  FOR r IN
    SELECT user_id, bracket_rank AS old_rank
    FROM league_scores
    WHERE league_id = p_league_id
    ORDER BY COALESCE(bracket_points, 0) DESC
  LOOP
    curr_bracket_rank := curr_bracket_rank + 1;
    UPDATE league_scores
    SET bracket_rank        = curr_bracket_rank,
        bracket_rank_change = COALESCE(r.old_rank, curr_bracket_rank) - curr_bracket_rank
    WHERE league_id = p_league_id AND user_id = r.user_id;
  END LOOP;

  -- Combined total for any legacy queries
  UPDATE league_scores
  SET total_points = COALESCE(picks_points, 0) + COALESCE(bracket_points, 0)
  WHERE league_id = p_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
