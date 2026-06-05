// Cron: runs every 5 minutes via Vercel
// Fetches live/finished match scores from football-data.org
// and updates the matches table in Supabase

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC_COMPETITION_CODE = 'WC'
const FD_BASE = 'https://api.football-data.org/v4'

type FDStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED'

interface FDMatch {
  id: number
  status: FDStatus
  score: {
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
}

function mapStatus(fdStatus: FDStatus): string {
  switch (fdStatus) {
    case 'FINISHED':
      return 'FINISHED'
    case 'POSTPONED':
    case 'SUSPENDED':
      return 'POSTPONED'
    default:
      return 'SCHEDULED'
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  try {
    // Fetch only finished matches — scores are final, no mid-game polling needed
    const res = await fetch(
      `${FD_BASE}/competitions/${WC_COMPETITION_CODE}/matches?status=FINISHED`,
      {
        headers: { 'X-Auth-Token': FD_API_KEY },
        next: { revalidate: 0 },
      }
    )

    if (!res.ok) {
      throw new Error(`football-data.org returned ${res.status}`)
    }

    const data = await res.json()
    const fdMatches: FDMatch[] = data.matches ?? []

    if (fdMatches.length === 0) {
      return NextResponse.json({ message: 'No active matches', synced: 0 })
    }

    // Batch update all matches
    let synced = 0
    for (const fdMatch of fdMatches) {
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: fdMatch.score.fullTime.home,
          away_score: fdMatch.score.fullTime.away,
          home_score_ht: fdMatch.score.halfTime.home,
          away_score_ht: fdMatch.score.halfTime.away,
          status: mapStatus(fdMatch.status),
          updated_at: new Date().toISOString(),
        })
        .eq('api_match_id', fdMatch.id)

      if (!error) synced++
    }

    return NextResponse.json({ message: 'Sync complete', synced, total: fdMatches.length })
  } catch (err: any) {
    console.error('[sync-scores]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
