// GET|POST /api/score-bracket
// Recomputes all bracket scores from current tournament_results.
// Works incrementally -- safe to call after any round completes.
// Auth: CRON_SECRET (cron) OR an admin session (manual).
//
// Scoring (GDD section 2.2 -- values live in lib/bracket-scoring.ts):
//   Group 1st correct:            2 pts x 12 = 24 max
//   Group 2nd correct:            2 pts x 12 = 24 max
//   3rd-place qualifier correct:  2 pts x 8  = 16 max
//   R32 pick correct:             3 pts x 16 = 48 max
//   R16 pick correct:             5 pts x 8  = 40 max
//   QF  pick correct:             8 pts x 4  = 32 max
//   SF  pick correct:            13 pts x 2  = 26 max
//   Champion (Final) correct:    21 pts x 1  = 21 max
//                                       Total = 231 max

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'
import { scoreBrackets } from '@/lib/score-utils'

async function handler(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const result = await scoreBrackets(supabase)
    return NextResponse.json({ ok: true, scored: result.scored })
  } catch (err: any) {
    console.error('[score-bracket]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
