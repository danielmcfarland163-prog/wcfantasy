// GET|POST /api/derive-results
// Recomputes tournament_results (group_results, third_quals, r32…final) from the
// real match rows + captured knockout winners, then persists the single results
// row. Runs in the 0 */6 cron sequence BEFORE score-bracket so bracket scoring
// reflects reality (Blocker B4, Path A). Without this, tournament_results is only
// ever written by the admin simulator and score-bracket scores 0 in production.
// Auth: CRON_SECRET (cron) OR an admin session (manual).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'
import { deriveResults } from '@/lib/derive-results'

async function handler(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { scored, results } = await deriveResults(supabase)
    return NextResponse.json({
      ok: true,
      knockoutSlotsResolved: scored,
      champion: results.final_result,
    })
  } catch (err: any) {
    console.error('[derive-results]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
