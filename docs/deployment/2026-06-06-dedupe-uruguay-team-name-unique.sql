-- Migration: dedupe_uruguay_add_team_name_unique (applied 2026-06-06 to vgguaeutmljgvxdcfmkd)
-- Removes the duplicate Uruguay team row and guards against recurrence.
--
-- Cause: seed-teams inserted Uruguay as short_code 'URU' (grouped, no api_id);
-- bootstrap-matches then inserted football-data's 'URY' (api_id 758, no group),
-- because the TLAs differ — leaving two "Uruguay" rows (teams = 49). Matches
-- reference the api_id row; brackets/results store team NAMES, so the orphan is
-- safe to drop without repointing.

update teams
  set group_letter = 'H',
      flag_emoji   = coalesce(flag_emoji, '🇺🇾')
  where name = 'Uruguay' and api_id = 758;

delete from teams where name = 'Uruguay' and api_id is null;

-- Prevent recurrence: a team name must be unique (the dup was one team, two codes).
create unique index if not exists teams_name_unique on teams (name);

-- Result: teams = 48; single Uruguay row (short_code URY, group H, api_id 758).
-- Code follow-up: src/app/api/seed-teams/route.ts now seeds Uruguay as 'URY'.
