-- =====================================================================
-- 2026-06-07 — Reveal picks on LIVE/FINISHED (not just kickoff_time)
-- Supabase migration name: picks_visible_on_live_or_finished
-- =====================================================================
-- Enables the per-player picks summary (/leagues/[id]/picks/[userId]):
-- a league member can view another member's picks once a match has started.
-- Previously visibility keyed only on kickoff_time < now(), so simulated
-- matches (status FINISHED while the real kickoff is still in the future)
-- kept every other player's picks hidden. Picks are already locked at kickoff
-- (the INSERT/UPDATE policies require kickoff > now), so revealing on
-- LIVE/FINISHED leaks nothing early in production.

DROP POLICY IF EXISTS "Users see all picks after match kickoff" ON public.picks;
CREATE POLICY "Users see all picks after match kickoff" ON public.picks FOR SELECT
USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = picks.match_id
      AND (m.kickoff_time < now() OR m.status IN ('LIVE','FINISHED'))
  )
);
