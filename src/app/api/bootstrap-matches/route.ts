// POST /api/bootstrap-matches — one-shot seed of 2026 WC teams + matches from football-data.org.
// Destructive (service-role upserts over teams + matches). Superseded by /api/seed-teams (teams)
// + /api/sync-fixtures (idempotent schedule incl. knockouts); kept only for first-run setup.
// Auth: CRON_SECRET (cron worker) OR an admin session — via the shared isCronOrAdmin guard.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC_COMPETITION_CODE = 'WC'
const FD_BASE = 'https://api.football-data.org/v4'

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  // Fetch teams
  const teamsRes = await fetch(`${FD_BASE}/competitions/${WC_COMPETITION_CODE}/teams`, {
    headers: { 'X-Auth-Token': FD_API_KEY },
  })
  const teamsData = await teamsRes.json()

  // Upsert teams
  const teamsToInsert = (teamsData.teams ?? []).map((t: any) => ({
    name: t.name,
    short_code: t.tla,
    api_id: t.id,
    flag_emoji: t.flag ?? null,
  }))

  const { error: teamErr } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { onConflict: 'short_code' })

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 })

  // Re-fetch teams to get our UUIDs
  const { data: dbTeams } = await supabase.from('teams').select('id, api_id')
  const apiIdToUUID = new Map((dbTeams ?? []).map(t => [t.api_id, t.id]))

  // Fetch all matches
  const matchesRes = await fetch(`${FD_BASE}/competitions/${WC_COMPETITION_CODE}/matches`, {
    headers: { 'X-Auth-Token': FD_API_KEY },
  })
  const matchesData = await matchesRes.json()

  const matchesToInsert = (matchesData.matches ?? []).map((m: any) => ({
    api_match_id: m.id,
    home_team_id: apiIdToUUID.get(m.homeTeam?.id) ?? null,
    away_team_id: apiIdToUUID.get(m.awayTeam?.id) ?? null,
    kickoff_time: m.utcDate,
    stage: mapStage(m.stage),
    group_letter: m.group ? m.group.replace('GROUP_', '') : null,
    status: 'SCHEDULED',
  })).filter((m: any) => m.home_team_id && m.away_team_id)

  const { error: matchErr } = await supabase
    .from('matches')
    .upsert(matchesToInsert, { onConflict: 'api_match_id' })

  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 })

  return NextResponse.json({
    message: 'Bootstrap complete',
    teams: teamsToInsert.length,
    matches: matchesToInsert.length,
  })
}

function mapStage(fdStage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: 'GROUP',
    ROUND_OF_32: 'R32',
    ROUND_OF_16: 'R16',
    QUARTER_FINALS: 'QF',
    SEMI_FINALS: 'SF',
    THIRD_PLACE: 'THIRD',
    FINAL: 'FINAL',
  }
  return map[fdStage] ?? 'GROUP'
}
