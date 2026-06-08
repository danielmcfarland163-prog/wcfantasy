-- =====================================================================
-- 2026-06-08 — Phased bracket: group lock + knockout lock
-- Supabase migration name: phased_bracket_locks
-- =====================================================================
-- WHY: The bracket is now filled in two phases instead of one snapshot:
--   Phase 1  GROUP picks (group_picks / third_picks / third_quals) — freeze at
--            the first match kickoff (the GROUP lock, 2026-06-11 15:00 UTC).
--   Phase 2  KNOCKOUT bracket (r32/r16/qf/sf/final) — opens once the real group
--            stage is over and freezes at the Round of 32 kickoff (the KNOCKOUT
--            lock, 2026-06-28 19:00 UTC = 3pm ET).
--
-- The previous policy (2026-06-06-bracket-entries-time-based-lock.sql) blocked
-- ALL writes after 2026-06-11, which would make it impossible to submit knockout
-- picks after the group stage finishes (~late June). This migration:
--   1. widens the RLS write window to the KNOCKOUT lock, and
--   2. adds a per-row trigger that freezes the GROUP columns at the group lock and
--      the KNOCKOUT columns at the knockout lock — so a phase-2 save (which upserts
--      the whole row) can change knockout picks without reopening group picks.
--
-- Keep these timestamps in sync with NEXT_PUBLIC_BRACKET_LOCK (group) and
-- NEXT_PUBLIC_KNOCKOUT_LOCK (knockout) used by the app (src/lib/bracket.ts).
-- service_role bypasses RLS + triggers, so admin tools and scoring are unaffected.
-- =====================================================================

-- 1) Write window now runs until the KNOCKOUT lock (was the group lock).
drop policy if exists "Users manage own entry before lock"          on bracket_entries;
drop policy if exists "Users manage own entry before knockout lock" on bracket_entries;
create policy "Users manage own entry before knockout lock" on bracket_entries
  for all to public
  using      (auth.uid() = user_id and now() < timestamptz '2026-06-28T19:00:00Z')
  with check (auth.uid() = user_id and now() < timestamptz '2026-06-28T19:00:00Z');

-- Read policy unchanged in spirit: own row always; others' rows once the group
-- stage has started (group picks become public at kickoff, same as My Picks).
-- The app additionally hides the KNOCKOUT portion of other members' brackets
-- until the knockout lock.
drop policy if exists "Users read own entry or after lock" on bracket_entries;
create policy "Users read own entry or after lock" on bracket_entries
  for select to public
  using (auth.uid() = user_id or now() >= timestamptz '2026-06-11T15:00:00Z');

-- 2) Per-phase freeze trigger. Compares NEW vs OLD so a phase-2 save that re-sends
--    the (unchanged) group columns is allowed; only an actual change to a frozen
--    column is rejected. INSERTs are unaffected (no prior row to protect).
create or replace function public.enforce_bracket_phase_locks()
returns trigger
language plpgsql
as $$
declare
  group_lock constant timestamptz := timestamptz '2026-06-11T15:00:00Z';
  ko_lock    constant timestamptz := timestamptz '2026-06-28T19:00:00Z';
begin
  if tg_op = 'UPDATE' then
    if now() >= group_lock and (
         new.group_picks is distinct from old.group_picks
      or new.third_picks is distinct from old.third_picks
      or new.third_quals is distinct from old.third_quals
    ) then
      raise exception 'Group picks are locked (closed %)', group_lock
        using errcode = 'check_violation';
    end if;

    if now() >= ko_lock and (
         new.r32_picks  is distinct from old.r32_picks
      or new.r16_picks  is distinct from old.r16_picks
      or new.qf_picks   is distinct from old.qf_picks
      or new.sf_picks   is distinct from old.sf_picks
      or new.final_pick is distinct from old.final_pick
    ) then
      raise exception 'Knockout picks are locked (closed %)', ko_lock
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bracket_phase_locks on bracket_entries;
create trigger trg_bracket_phase_locks
  before insert or update on bracket_entries
  for each row execute function public.enforce_bracket_phase_locks();
