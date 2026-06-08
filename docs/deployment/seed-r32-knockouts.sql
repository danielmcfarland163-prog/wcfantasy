-- =============================================================================
-- seed-r32-knockouts.sql  —  TEST-ONLY knockout fixtures (Blocker B4, Path B)
-- =============================================================================
-- Seeds the 16 Round-of-32 matches from the CURRENT simulated standings in
-- tournament_results, so knockout *scoreline picks* can be exercised before the
-- real football-data.org knockout fixtures exist.
--
--   • Pairings mirror R32_FIXTURES (lib/bracket.ts) / the simulator's r32Pairs.
--   • api_match_id = NULL  → a later real sync-fixtures will NOT collide.
--   • Run AFTER simulating the group stage (group_results + third_quals filled).
--   • REVERSIBLE — see the cleanup block at the bottom. Remove these rows before
--     real fixtures arrive (real sync-fixtures would otherwise add duplicates).
--
-- Safe to run against the test DB (project vgguaeutmljgvxdcfmkd). Do NOT ship
-- these rows to a live tournament — this is a pre-launch testing aid.
-- =============================================================================

INSERT INTO matches (api_match_id, home_team_id, away_team_id, kickoff_time, stage, status)
WITH tr AS (
  SELECT group_results AS gr, third_quals AS tq
  FROM tournament_results WHERE id = 1
),
slots(slot, home_name, away_name) AS (
  VALUES
    ( 1, (SELECT gr->'A'->>'first'  FROM tr), (SELECT gr->'B'->>'second' FROM tr)),
    ( 2, (SELECT gr->'B'->>'first'  FROM tr), (SELECT gr->'A'->>'second' FROM tr)),
    ( 3, (SELECT gr->'C'->>'first'  FROM tr), (SELECT gr->'D'->>'second' FROM tr)),
    ( 4, (SELECT gr->'D'->>'first'  FROM tr), (SELECT gr->'C'->>'second' FROM tr)),
    ( 5, (SELECT gr->'E'->>'first'  FROM tr), (SELECT gr->'F'->>'second' FROM tr)),
    ( 6, (SELECT gr->'F'->>'first'  FROM tr), (SELECT gr->'E'->>'second' FROM tr)),
    ( 7, (SELECT gr->'G'->>'first'  FROM tr), (SELECT gr->'H'->>'second' FROM tr)),
    ( 8, (SELECT gr->'H'->>'first'  FROM tr), (SELECT gr->'G'->>'second' FROM tr)),
    ( 9, (SELECT gr->'I'->>'first'  FROM tr), (SELECT gr->'J'->>'second' FROM tr)),
    (10, (SELECT gr->'J'->>'first'  FROM tr), (SELECT gr->'I'->>'second' FROM tr)),
    (11, (SELECT gr->'K'->>'first'  FROM tr), (SELECT gr->'L'->>'second' FROM tr)),
    (12, (SELECT gr->'L'->>'first'  FROM tr), (SELECT gr->'K'->>'second' FROM tr)),
    (13, (SELECT tq->>0 FROM tr),             (SELECT tq->>7 FROM tr)),
    (14, (SELECT tq->>1 FROM tr),             (SELECT tq->>6 FROM tr)),
    (15, (SELECT tq->>2 FROM tr),             (SELECT tq->>5 FROM tr)),
    (16, (SELECT tq->>3 FROM tr),             (SELECT tq->>4 FROM tr))
),
mapped AS (
  SELECT s.slot, ht.id AS home_id, at.id AS away_id
  FROM slots s
  JOIN teams ht ON ht.name = s.home_name
  JOIN teams at ON at.name = s.away_name
)
SELECT
  NULL::int,
  home_id,
  away_id,
  TIMESTAMPTZ '2026-06-29 18:00:00+00' + (slot - 1) * INTERVAL '3 hours',
  'R32',
  'SCHEDULED'
FROM mapped
-- Idempotent: do nothing if any knockout rows already exist.
WHERE NOT EXISTS (SELECT 1 FROM matches WHERE stage <> 'GROUP');

-- Expect: INSERT 0 16   (16 R32 fixtures created)
-- Verify:
--   SELECT stage, count(*) FROM matches GROUP BY stage ORDER BY stage;

-- =============================================================================
-- CLEANUP (run to remove the test knockout rows; picks first to satisfy the FK)
-- =============================================================================
-- DELETE FROM picks  WHERE match_id IN (SELECT id FROM matches WHERE stage <> 'GROUP');
-- DELETE FROM matches WHERE stage <> 'GROUP';
