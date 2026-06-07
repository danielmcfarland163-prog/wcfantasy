// GET|POST /api/sync-fixtures
// Idempotently syncs the full WC match schedule from football-data.org —
// including knockout fixtures (R32 → Final) as their teams are decided.
// Unlike the one-shot /api/bootstrap-matches, this does NOT create team rows
// (that caused duplicate teams); it maps football-data team ids onto our
// existing teams via api_id, so it is safe to run on a schedule.
// Auth: CRON_SECRET (cron worker) OR an admin session.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC_COMPETITION_CODE = 'WC'
const FD_BASE = 'https://api.football-data.org/v4'

function mapStage(fdStage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: 'GROUP',
    LEAGUE_STAGE: 'GROUP',
    ROUND_OF_32: 'R32',
    LAST_32: 'R32',
    ROUND_OF_16: 'R16',
    LAST_16: 'R16',
    QUARTER_FINALS: 'QF',
    QUARTER_FINAL: 'QF',
    SEMI_FINALS: 'SF',
    SEMI_FINAL: 'SF',
    THIRD_PLACE: 'THIRD',
    FINAL: 'FINAL',
  }
  return map[fdStage] ?? 'GROUP'
}

function mapStatus(fdStatus: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  switch (fdStatus) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'LIVE'
    case 'FINISHED':
      return 'FINISHED'
    case 'POSTPONED':
    case 'SUSPENDED':
      return 'POSTPONED'
    default:
      return 'SCHEDULED'
  }
}

async function handler(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  try {
    // Map football-data team id → our team UUID (teams must already be seeded).
    const { data: dbTeams } = await supabase.from('teams').select('id, api_id').not('api_id', 'is', null)
    const apiIdToUUID = new Map<number, string>(
      (dbTeams ?? []).map((t: any) => [t.api_id as number, t.id as string] as [number, string]),
    )

    if (apiIdToUUID.size === 0) {
      return NextResponse.json({ error: 'No teams with api_id — run seed/bootstrap first' }, { status: 409 })
    }

    const res = await fetch(`${FD_BASE}/competitions/${WC_COMPETITION_CODE}/matches`, {
      headers: { 'X-Auth-Token': FD_API_KEY },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`football-data.org returned ${res.status}`)

    const data = await res.json()
    const fdMatches: any[] = data.matches ?? []

    // Build rows only for matches whose BOTH teams are known (knockout fixtures
    // with TBD teams are skipped until the draw/results resolve them, at which
    // point a later run creates them). Scores are intentionally omitted so a
    // concurrent sync-scores run remains the source of truth for live scores.
    const rows = fdMatches
      .map((m: any) => {
        const home = apiIdToUUID.get(m.homeTeam?.id)
        const away = apiIdToUUID.get(m.awayTeam?.id)
        if (!home || !away) return null
        return {
          api_match_id: m.id,
          home_team_id: home,
          away_team_id: away,
          kickoff_time: m.utcDate,
          stage: mapStage(m.stage),
          group_letter: m.group ? String(m.group).replace('GROUP_', '') : null,
          status: mapStatus(m.status),
        }
      })
      .filter(Boolean) as any[]

    if (rows.length === 0) {
      return NextResponse.json({ message: 'No resolvable fixtures yet', upserted: 0, totalFromApi: fdMatches.length })
    }

    const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'api_match_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Report a per-stage breakdown so the admin can see knockouts appear.
    const byStage = rows.reduce((acc: Record<string, number>, r: any) => {
      acc[r.stage] = (acc[r.stage] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      message: 'Fixtures synced',
      upserted: rows.length,
      skippedTBD: fdMatches.length - rows.length,
      totalFromApi: fdMatches.length,
      byStage,
    })
  } catch (err: any) {
    console.error('[sync-fixtures]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
