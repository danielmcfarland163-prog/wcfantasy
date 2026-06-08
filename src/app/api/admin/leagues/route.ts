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

export async function GET(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('leagues')
      .select('id, name, invite_code, created_at, member_count:league_members(count)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const { name, description } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('leagues')
      .insert({ name: name.trim(), description: description?.trim() || null })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, league: data })
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const { leagueId } = await req.json()
    const admin = createAdminSupabaseClient()
    const { error } = await admin.from('leagues').delete().eq('id', leagueId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
