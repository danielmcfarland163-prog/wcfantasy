// GET|POST /api/sync-scores
// Pulls current scores + statuses from football-data.org and updates the
// matches table. Captures LIVE (in-play) matches as well as finished ones,
// so the /live and /today surfaces reflect in-progress games.
// Auth: CRON_SECRET (cron worker) OR an admin session (manual "Sync" button).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC_COMPETITION_CODE = 'WC'
const FD_BASE = 'https://api.football-data.org/v4'

type FDStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED'

interface FDMatch {
  id: number
  status: FDStatus
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
}

// Map football-data statuses onto our enum: SCHEDULED | LIVE | FINISHED | POSTPONED
function mapStatus(fdStatus: FDStatus): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
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
    // Fetch the whole competition once; filter client-side to matches that have
    // a live or final state. (Free tier is fine at one call per cron tick.)
    const res = await fetch(`${FD_BASE}/competitions/${WC_COMPETITION_CODE}/matches`, {
      headers: { 'X-Auth-Token': FD_API_KEY },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`football-data.org returned ${res.status}`)
    }

    const data = await res.json()
    const fdMatches: FDMatch[] = data.matches ?? []

    // Only push matches that are in-play or settled — no need to rewrite the
    // hundreds of still-scheduled rows every tick.
    const actionable = fdMatches.filter(m => {
      const s = mapStatus(m.status)
      return s === 'LIVE' || s === 'FINISHED' || s === 'POSTPONED'
    })

    if (actionable.length === 0) {
      return NextResponse.json({ message: 'No live or finished matches', synced: 0 })
    }

    // Resolve our team UUIDs + stage per actionable fixture so we can record the
    // knockout WINNER (score.winner — covers extra time / penalties, which the
    // fullTime score alone doesn't). derive-results reads winner_team_id to build
    // the bracket; group matches leave it null (standings come from the score).
    const { data: metaRows } = await supabase
      .from('matches')
      .select('api_match_id, home_team_id, away_team_id, stage')
      .in('api_match_id', actionable.map((m) => m.id))
    const metaById = new Map<number, { home_team_id: string; away_team_id: string; stage: string }>(
      (metaRows ?? []).map((r: any) => [r.api_match_id as number, r]),
    )

    let synced = 0
    let live = 0
    let finished = 0
    for (const fdMatch of actionable) {
      const status = mapStatus(fdMatch.status)
      const meta = metaById.get(fdMatch.id)
      let winner_team_id: string | null = null
      if (meta && meta.stage !== 'GROUP' && status === 'FINISHED') {
        if (fdMatch.score.winner === 'HOME_TEAM') winner_team_id = meta.home_team_id
        else if (fdMatch.score.winner === 'AWAY_TEAM') winner_team_id = meta.away_team_id
      }
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: fdMatch.score.fullTime.home,
          away_score: fdMatch.score.fullTime.away,
          home_score_ht: fdMatch.score.halfTime.home,
          away_score_ht: fdMatch.score.halfTime.away,
          winner_team_id,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('api_match_id', fdMatch.id)

      if (!error) {
        synced++
        if (status === 'LIVE') live++
        if (status === 'FINISHED') finished++
      }
    }

    return NextResponse.json({ message: 'Sync complete', synced, live, finished, total: actionable.length })
  } catch (err: any) {
    console.error('[sync-scores]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
