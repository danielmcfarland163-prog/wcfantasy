-- Blocker B4 (Path A): capture knockout winners on matches.
-- Knockout games can be decided in extra time or penalties, where
-- home_score/away_score (the regulation/ET score) do NOT identify who advanced.
-- sync-scores writes this from football-data's `score.winner`; derive-results
-- reads it to build tournament_results.r32…final. NULL for group matches & draws.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS winner_team_id UUID REFERENCES public.teams(id);

COMMENT ON COLUMN public.matches.winner_team_id IS
  'Advancing team for knockout matches (covers extra time / penalties). NULL for group matches and draws. Set by sync-scores from football-data score.winner; read by derive-results.';
