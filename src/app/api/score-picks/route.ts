// GET|POST /api/score-picks
// Scores all un-scored picks for finished matches and re-aggregates standings.
// Auth: CRON_SECRET (cron) OR an admin session (manual).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'
import { scorePicks } from '@/lib/score-utils'

async function handler(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const result = await scorePicks(supabase)

    if (result.scored === 0) {
      return NextResponse.json({ message: 'No new picks to score — standings refreshed', scored: 0 })
    }

    return NextResponse.json({
      message: 'Scoring complete',
      scored:  result.scored,
      users:   result.users,
    })
  } catch (err: any) {
    console.error('[score-picks]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
