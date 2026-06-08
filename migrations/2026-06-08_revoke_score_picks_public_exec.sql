-- =====================================================================
-- 2026-06-08 — Lock down public.score_picks() to service_role only
-- Supabase migration name: revoke_score_picks_public_exec
-- =====================================================================
-- WHY: the original add_score_picks_rpc migration only ran
--   REVOKE ALL ON FUNCTION public.score_picks() FROM PUBLIC;
-- which does NOT remove Supabase's blanket EXECUTE grants to the `anon`
-- and `authenticated` roles. The scoring pipeline was therefore callable
-- UNAUTHENTICATED via POST /rest/v1/rpc/score_picks, bypassing the app's
-- isCronOrAdmin guard entirely (flagged by the Supabase security advisor
-- `anon_security_definer_function_executable`). score_picks() rebuilds
-- global_scores / league_scores and recomputes ranks, so an anonymous
-- caller could repeatedly trigger the whole pipeline — a DoS / abuse vector.
--
-- score_picks() is only ever invoked server-side through the service-role
-- admin client (api/score-picks + the simulate auto-score path), so revoke
-- the anon/authenticated grants explicitly and keep service_role.
--
-- NOTE: this is distinct from public.is_league_member(), which is
-- intentionally anon/authenticated-executable because it backs RLS policies
-- (including the anon "public leagues readable" policy) — do NOT revoke that.

REVOKE EXECUTE ON FUNCTION public.score_picks() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.score_picks() TO service_role;

-- Verify:
--   SELECT has_function_privilege('anon',          'public.score_picks()', 'EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated', 'public.score_picks()', 'EXECUTE'); -- false
--   SELECT has_function_privilege('service_role',  'public.score_picks()', 'EXECUTE'); -- true
