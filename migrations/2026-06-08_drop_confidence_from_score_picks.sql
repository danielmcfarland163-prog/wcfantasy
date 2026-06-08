-- =====================================================================
-- 2026-06-08 — Remove the confidence multiplier from My Picks scoring
-- Supabase migration name: drop_confidence_from_score_picks
-- =====================================================================
-- WHY: My Picks no longer offers a 1×/2×/3× confidence multiplier. Every
-- match is now worth a flat 0 / 3 / 5 (wrong / correct outcome / exact score),
-- matching lib/scoring.ts. This re-issues public.score_picks() with the
-- `* confidence_multiplier` factor stripped out.
--
-- The picks.confidence_multiplier column is intentionally LEFT IN PLACE
-- (defaults to 1) so historic rows and the API payload stay valid; it simply
-- no longer affects scoring. Idempotent + safe to re-run: re-running rebuilds
-- standings from scored picks (and will re-score any rows that predate this
-- change at the new flat values, since scored_at is preserved per row — run
-- the optional backfill block at the bottom to force a full re-score).
--
-- Scoring (mirrors lib/scoring.ts, driven by scoring_config):
--   exact score   -> correct_result_pts + exact_score_bonus   (5)
--   correct W/D/L  -> correct_result_pts                       (3)
--   else           -> 0
-- =====================================================================

CREATE OR REPLACE FUNCTION public.score_picks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_correct numeric := COALESCE((SELECT value FROM scoring_config WHERE key = 'correct_result_pts'), 3);
  v_exact   numeric := COALESCE((SELECT value FROM scoring_config WHERE key = 'exact_score_bonus'), 2);
  v_scored  integer := 0;
  v_users   integer := 0;
  lg RECORD;
BEGIN
  -- 1) Score every not-yet-scored pick whose match is FINISHED (single statement)
  --    No confidence multiplier: flat (correct) / (correct + exact) points.
  WITH upd AS (
    UPDATE public.picks p
    SET points_earned = CASE
          WHEN p.home_score_pick = m.home_score AND p.away_score_pick = m.away_score
            THEN (v_correct + v_exact)::int
          WHEN (p.home_score_pick > p.away_score_pick AND m.home_score > m.away_score)
            OR (p.home_score_pick < p.away_score_pick AND m.home_score < m.away_score)
            OR (p.home_score_pick = p.away_score_pick AND m.home_score = m.away_score)
            THEN v_correct::int
          ELSE 0
        END,
        pick_result = CASE
          WHEN p.home_score_pick = m.home_score AND p.away_score_pick = m.away_score THEN 'EXACT'
          WHEN (p.home_score_pick > p.away_score_pick AND m.home_score > m.away_score)
            OR (p.home_score_pick < p.away_score_pick AND m.home_score < m.away_score)
            OR (p.home_score_pick = p.away_score_pick AND m.home_score = m.away_score) THEN 'CORRECT'
          ELSE 'WRONG'
        END,
        scored_at  = now(),
        updated_at = now()
    FROM public.matches m
    WHERE p.match_id = m.id
      AND m.status = 'FINISHED'
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
      AND p.scored_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_scored FROM upd;

  -- 2) Rebuild per-user aggregates from ALL scored picks (idempotent rebuild)
  DROP TABLE IF EXISTS _score_agg;
  CREATE TEMP TABLE _score_agg ON COMMIT DROP AS
    SELECT user_id,
           COALESCE(sum(points_earned), 0)::int AS pts,
           count(*) FILTER (WHERE pick_result IN ('CORRECT','EXACT'))::int AS correct,
           count(*) FILTER (WHERE pick_result = 'EXACT')::int AS exact_n,
           count(*)::int AS made
    FROM public.picks
    WHERE scored_at IS NOT NULL
    GROUP BY user_id;

  SELECT count(*) INTO v_users FROM _score_agg;

  -- 3) global_scores: write Picks columns, preserve bracket_points, total = picks + bracket
  INSERT INTO public.global_scores AS gs
    (user_id, picks_points, picks_correct, exact_scores, correct_results, picks_made, total_points, updated_at)
  SELECT a.user_id, a.pts, a.correct, a.exact_n, a.correct, a.made,
         a.pts + COALESCE(g.bracket_points, 0), now()
  FROM _score_agg a
  LEFT JOIN public.global_scores g ON g.user_id = a.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    picks_points    = EXCLUDED.picks_points,
    picks_correct   = EXCLUDED.picks_correct,
    exact_scores    = EXCLUDED.exact_scores,
    correct_results = EXCLUDED.correct_results,
    picks_made      = EXCLUDED.picks_made,
    total_points    = EXCLUDED.picks_points + COALESCE(gs.bracket_points, 0),
    updated_at      = now();

  -- 4) league_scores for every membership (rank fn re-derives total = picks + bracket)
  INSERT INTO public.league_scores AS ls
    (league_id, user_id, picks_points, total_points, correct_results, exact_scores, picks_made, updated_at)
  SELECT lm.league_id, a.user_id, a.pts,
         a.pts + COALESCE(x.bracket_points, 0), a.correct, a.exact_n, a.made, now()
  FROM _score_agg a
  JOIN public.league_members lm ON lm.user_id = a.user_id
  LEFT JOIN public.league_scores x ON x.league_id = lm.league_id AND x.user_id = a.user_id
  ON CONFLICT (league_id, user_id) DO UPDATE SET
    picks_points    = EXCLUDED.picks_points,
    correct_results = EXCLUDED.correct_results,
    exact_scores    = EXCLUDED.exact_scores,
    picks_made      = EXCLUDED.picks_made,
    total_points    = EXCLUDED.picks_points + COALESCE(ls.bracket_points, 0),
    updated_at      = now();

  -- 5) Recompute ranks for each affected league
  FOR lg IN
    SELECT DISTINCT lm.league_id
    FROM public.league_members lm
    JOIN _score_agg a ON a.user_id = lm.user_id
  LOOP
    PERFORM public.recalculate_league_rankings(lg.league_id);
  END LOOP;

  -- 6) Recompute global ranks
  WITH ranked AS (
    SELECT user_id, row_number() OVER (ORDER BY total_points DESC, updated_at ASC) AS rn
    FROM public.global_scores
  )
  UPDATE public.global_scores g
  SET global_rank = r.rn
  FROM ranked r
  WHERE r.user_id = g.user_id;

  RETURN jsonb_build_object('scored', v_scored, 'users', v_users);
END;
$$;

REVOKE ALL ON FUNCTION public.score_picks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.score_picks() TO service_role;

-- Optional: force a full re-score at the new flat values (clears scored_at so
-- every finished-match pick is recomputed on the next run). Only needed if any
-- picks were already scored WITH a multiplier before this migration:
--   UPDATE public.picks SET scored_at = NULL, points_earned = NULL, pick_result = NULL
--     WHERE scored_at IS NOT NULL;
--   SELECT public.score_picks();
