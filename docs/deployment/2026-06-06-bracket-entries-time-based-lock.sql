-- Migration: bracket_entries_time_based_lock (applied 2026-06-06 to vgguaeutmljgvxdcfmkd)
-- Enforces the bracket lock on the server, replacing dead `locked`-flag gating.
--
-- Before: policies gated on a `locked` boolean the client never set, so (a) owners
-- could still PATCH their bracket via the API after the deadline, and (b) entries
-- never became visible to other league members (Bracket Reviews showed only your own).
-- After: real time logic against the first-kickoff lock (2026-06-11 15:00 UTC).
-- service_role bypasses RLS, so admin tools and the scoring engine are unaffected.

drop policy if exists "Users manage own entry before lock" on bracket_entries;
create policy "Users manage own entry before lock" on bracket_entries
  for all to public
  using      (auth.uid() = user_id and now() < timestamptz '2026-06-11T15:00:00Z')
  with check (auth.uid() = user_id and now() < timestamptz '2026-06-11T15:00:00Z');

drop policy if exists "Users read own entry or after lock" on bracket_entries;
create policy "Users read own entry or after lock" on bracket_entries
  for select to public
  using (auth.uid() = user_id or now() >= timestamptz '2026-06-11T15:00:00Z');
