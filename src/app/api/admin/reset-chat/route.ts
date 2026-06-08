import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/admin'

async function guard(req: NextRequest) {
  const { createServerSupabaseClient } = await import('@/lib/supabase-server')
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminUser(user.id)) return null
  return user
}

// Turns a thrown misconfiguration (e.g. missing SUPABASE_SERVICE_ROLE_KEY) into a
// JSON 500 the admin UI can display, rather than an unhandled HTML error.
function serverError(e: unknown) {
  const message = e instanceof Error ? e.message : 'Unexpected server error'
  return NextResponse.json({ error: message }, { status: 500 })
}

// Clears the chat history for a league. With `leagueId`, only that league is wiped;
// with `{ all: true }`, every league's chat is cleared. Uses the service-role client
// so it bypasses the per-user "delete own messages" RLS policy on chat_messages.
export async function POST(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const { leagueId, all } = await req.json()
    if (!leagueId && !all) {
      return NextResponse.json({ error: 'leagueId (or all: true) is required' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    let query = admin.from('chat_messages').delete()
    // A delete needs a WHERE clause; for "all" we match every real row via a
    // tautology on the non-null primary key.
    query = all ? query.not('id', 'is', null) : query.eq('league_id', leagueId)

    const { data, error } = await query.select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, deleted: data?.length ?? 0 })
  } catch (e) {
    return serverError(e)
  }
}
