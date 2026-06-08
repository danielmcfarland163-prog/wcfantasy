-- Descope: Tournament Bonus Picks (champion / runner-up / golden boot)
-- Removed from scope 2026-06-08. Drops the unused, empty scaffolding so the
-- live database matches schema.sql after the feature was cut.
--
-- Data-safe: tournament_picks holds 0 rows, and the three scoring_config keys
-- below were read only by the (never-built) bonus-picks feature. The other
-- scoring_config keys (correct_result_pts, exact_score_bonus) are untouched.

BEGIN;

-- Drops the table and its RLS policies in one step.
DROP TABLE IF EXISTS tournament_picks;

DELETE FROM scoring_config
WHERE key IN ('champion_pts', 'runner_up_pts', 'golden_boot_pts');

COMMIT;
