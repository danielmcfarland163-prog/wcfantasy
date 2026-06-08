-- =====================================================================
-- 2026-06-08 — Two bracket game modes: "pickem" + "reset"
-- Supabase migration name: bracket_two_modes
-- =====================================================================
-- The Bracket game now has TWO independent modes, each its own entry + score:
--
--   pickem  Up-Front Pick'em — fill the WHOLE bracket before the tournament
--           (groups → 3rd → R32 → R16 → QF → SF → winner). The knockout is
--           seeded from the player's OWN predicted groups. Everything locks at
--           the first match kickoff (the group lock, 2026-06-11 15:00 UTC).
--
--   reset   Bracket Reset — group + 3rd lock at the group lock; the knockout
--           then RE-opens, seeded from the ACTUAL Round of 32, and locks at the
--           R32 kickoff (the knockout lock, 2026-06-28 19:00 UTC).
--
-- This SUPERSEDES migrations/2026-06-08_phased_bracket_locks.sql — apply this one
-- (it re-creates the write policy + freeze trigger, now mode-aware). Safe to run
-- after that migration too; it just re-creates the same objects.
--
-- service_role bypasses RLS + the trigger, so admin tools and scoring are
-- unaffected. Keep the timestamps in sync with NEXT_PUBLIC_BRACKET_LOCK (group)
-- and NEXT_PUBLIC_KNOCKOUT_LOCK (knockout) in src/lib/bracket.ts.
-- =====================================================================

-- 1) mode column + composite primary key (user_id, mode). Existing single-mode
--    rows default to 'pickem'. The client always sets mode explicitly on save.
alter table public.bracket_entries
  add column if not exists mode text not null default 'pickem';

alter table public.bracket_entries
  drop constraint if exists bracket_entries_mode_check;
alter table public.bracket_entries
  add constraint bracket_entries_mode_check check (mode in ('pickem','reset'));

-- Swap PK from (user_id) to (user_id, mode). Existing rows keep their data under
-- mode='pickem'. (Postgres lets a column stay in two PKs only via constraint swap.)
alter table public.bracket_entries
  drop constraint if exists bracket_entries_pkey;
alter table public.bracket_entries
  add constraint bracket_entries_pkey primary key (user_id, mode);

-- 2) Write window runs until the later (knockout) lock; the trigger below applies
--    the real per-mode/per-phase freeze.
drop policy if exists "Users manage own entry before lock"          on public.bracket_entries;
drop policy if exists "Users manage own entry before knockout lock" on public.bracket_entries;
create policy "Users manage own entry before knockout lock" on public.bracket_entries
  for all to public
  using      (auth.uid() = user_id and now() < timestamptz '2026-06-28T19:00:00Z')
  with check (auth.uid() = user_id and now() < timestamptz '2026-06-28T19:00:00Z');

drop policy if exists "Users read own entry or after lock" on public.bracket_entries;
create policy "Users read own entry or after lock" on public.bracket_entries
  for select to public
  using (auth.uid() = user_id or now() >= timestamptz '2026-06-11T15:00:00Z');

-- 3) Mode-aware freeze trigger.
--    Group columns (group_picks/third_picks/third_quals) freeze at the GROUP lock
--    in BOTH modes. Knockout columns freeze at the GROUP lock for pickem (it's a
--    single up-front lock) and at the KNOCKOUT lock for reset. Compares NEW vs OLD
--    so a save that re-sends unchanged columns is always allowed.
create or replace function public.enforce_bracket_phase_locks()
returns trigger
language plpgsql
as $$
declare
  group_lock constant timestamptz := timestamptz '2026-06-11T15:00:00Z';
  ko_lock    constant timestamptz := timestamptz '2026-06-28T19:00:00Z';
  ko_changed boolean;
begin
  if tg_op = 'UPDATE' then
    -- Group-stage columns: same lock for both modes.
    if now() >= group_lock and (
         new.group_picks is distinct from old.group_picks
      or new.third_picks is distinct from old.third_picks
      or new.third_quals is distinct from old.third_quals
    ) then
      raise exception 'Group picks are locked (closed %)', group_lock
        using errcode = 'check_violation';
    end if;

    ko_changed :=
         new.r32_picks  is distinct from old.r32_picks
      or new.r16_picks  is distinct from old.r16_picks
      or new.qf_picks   is distinct from old.qf_picks
      or new.sf_picks   is distinct from old.sf_picks
      or new.final_pick is distinct from old.final_pick;

    if ko_changed then
      if new.mode = 'pickem' and now() >= group_lock then
        raise exception 'Pick''em bracket is locked (closed %)', group_lock
          using errcode = 'check_violation';
      elsif new.mode = 'reset' and now() >= ko_lock then
        raise exception 'Knockout picks are locked (closed %)', ko_lock
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bracket_phase_locks on public.bracket_entries;
create trigger trg_bracket_phase_locks
  before insert or update on public.bracket_entries
  for each row execute function public.enforce_bracket_phase_locks();
