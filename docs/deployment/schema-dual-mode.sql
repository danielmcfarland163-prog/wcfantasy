-- =============================================
-- DUAL-MODE LEAGUE STANDINGS MIGRATION
-- World Cup Fantasy 2026
-- Run AFTER schema.sql and schema-bracket.sql
-- =============================================

-- =============================================
-- 0. ADD game_mode TO leagues
-- picks | bracket | both | combined
-- =============================================

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'both'
    CHECK (game_mode IN ('picks', 'bracket', 'both', 'combined'));

-- =============================================
-- 1. ADD DUAL-MODE COLUMNS TO league_scores
-- Separate points/rank tracking per game mode
-- =============================================

ALTER TABLE league_scores
  ADD COLUMN IF NOT EXISTS picks_points     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS picks_rank       INTEGER,
  ADD COLUMN IF NOT EXISTS picks_rank_change INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bracket_points   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bracket_rank     INTEGER,
  ADD COLUMN IF NOT EXISTS bracket_rank_change INTEGER DEFAULT 0;

-- Migrate existing total_points into picks_points
-- (pre-migration data assumed to be picks-mode only)
UPDATE league_scores
SET picks_points = total_points
WHERE picks_points = 0 AND total_points > 0;

-- =============================================
-- 2. ADD DUAL-MODE COLUMNS TO global_scores
-- =============================================

ALTER TABLE global_scores
  ADD COLUMN IF NOT EXISTS picks_points     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS picks_rank       INTEGER,
  ADD COLUMN IF NOT EXISTS bracket_points   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bracket_rank     INTEGER;

-- Migrate existing data
UPDATE global_scores
SET picks_points = total_points
WHERE picks_points = 0 AND total_points > 0;

-- =============================================
-- 3. REPLACE recalculate_league_rankings
-- Now recalculates both modes independently
-- =============================================

CREATE OR REPLACE FUNCTION recalculate_league_rankings(p_league_id UUID)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  curr_picks_rank  INTEGER := 0;
  curr_bracket_rank INTEGER := 0;
BEGIN
  -- Recalculate picks ranks
  FOR r IN
    SELECT user_id, picks_points, picks_rank AS old_rank
    FROM league_scores
    WHERE league_id = p_league_id
    ORDER BY picks_points DESC
  LOOP
    curr_picks_rank := curr_picks_rank + 1;
    UPDATE league_scores
    SET picks_rank        = curr_picks_rank,
        picks_rank_change = COALESCE(r.old_rank, curr_picks_rank) - curr_picks_rank
    WHERE league_id = p_league_id AND user_id = r.user_id;
  END LOOP;

  -- Recalculate bracket ranks
  FOR r IN
    SELECT user_id, bracket_points, bracket_rank AS old_rank
    FROM league_scores
    WHERE league_id = p_league_id
    ORDER BY bracket_points DESC
  LOOP
    curr_bracket_rank := curr_bracket_rank + 1;
    UPDATE league_scores
    SET bracket_rank        = curr_bracket_rank,
        bracket_rank_change = COALESCE(r.old_rank, curr_bracket_rank) - curr_bracket_rank
    WHERE league_id = p_league_id AND user_id = r.user_id;
  END LOOP;

  -- Keep total_points as combined sum for any legacy queries
  UPDATE league_scores
  SET total_points = picks_points + bracket_points
  WHERE league_id = p_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. HELPER: update a user's picks points
-- Called from score-picks API after scoring
-- =============================================

CREATE OR REPLACE FUNCTION update_league_picks_points(
  p_user_id UUID,
  p_delta    INTEGER   -- points earned from this scoring run
)
RETURNS VOID AS $$
BEGIN
  -- Update all leagues this user is in
  UPDATE league_scores ls
  SET picks_points = picks_points + p_delta,
      total_points = picks_points + bracket_points + p_delta,
      updated_at   = NOW()
  WHERE ls.user_id = p_user_id;

  -- Update global
  UPDATE global_scores
  SET picks_points  = picks_points + p_delta,
      total_points  = picks_points + bracket_points + p_delta,
      updated_at    = NOW()
  WHERE user_id = p_user_id;

  -- Recalculate rankings for each affected league
  PERFORM recalculate_league_rankings(league_id)
  FROM league_members
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. HELPER: update a user's bracket points
-- Called from score-bracket API after scoring
-- =============================================

CREATE OR REPLACE FUNCTION update_league_bracket_points(
  p_user_id       UUID,
  p_bracket_total INTEGER   -- full recalculated bracket score (not a delta)
)
RETURNS VOID AS $$
BEGIN
  UPDATE league_scores ls
  SET bracket_points = p_bracket_total,
      total_points   = picks_points + p_bracket_total,
      updated_at     = NOW()
  WHERE ls.user_id = p_user_id;

  UPDATE global_scores
  SET bracket_points = p_bracket_total,
      total_points   = picks_points + p_bracket_total,
      updated_at     = NOW()
  WHERE user_id = p_user_id;

  PERFORM recalculate_league_rankings(league_id)
  FROM league_members
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. REALTIME — ensure bracket_points changes
--    are broadcast (already on publication)
-- =============================================
-- league_scores is already on supabase_realtime from schema.sql
-- No changes needed here.

-- =============================================
-- NOTES FOR score-picks / score-bracket APIs
-- =============================================
-- score-picks:   after updating picks.points_earned, call
--                update_league_picks_points(user_id, delta)
--
-- score-bracket: after calculating bracket total for a user, call
--                update_league_bracket_points(user_id, bracket_total)
--
-- UI leaderboard query example (Picks tab):
--   SELECT p.display_name, ls.picks_points, ls.picks_rank, ls.picks_rank_change
--   FROM league_scores ls JOIN profiles p ON p.id = ls.user_id
--   WHERE ls.league_id = $1
--   ORDER BY ls.picks_rank ASC
--
-- UI leaderboard query example (Bracket tab):
--   SELECT p.display_name, ls.bracket_points, ls.bracket_rank, ls.bracket_rank_change
--   FROM league_scores ls JOIN profiles p ON p.id = ls.user_id
--   WHERE ls.league_id = $1
--   ORDER BY ls.bracket_rank ASC
