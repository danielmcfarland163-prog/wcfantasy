// GET /api/score-picks
// Scores all un-scored picks for finished matches.
// Protected by CRON_SECRET (cron) or admin session (manual).
// Cron: runs every 10 minutes during group stage.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/admin'
import { scorePicks } from '@/lib/score-utils'

async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user && isAdminUser(user.id)
  } catch { return false }
}

export async function GET(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const result = await scorePicks(supabase)

    if (result.scored === 0) {
      return NextResponse.json({ message: 'Nothing to score', scored: 0 })
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
