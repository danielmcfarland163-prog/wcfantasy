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

export async function POST(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId, type } = await req.json()
  const admin = createAdminSupabaseClient()

  if (type === 'bracket') {
    const { error } = await admin.from('bracket_entries').delete().eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (type === 'picks') {
    const { error } = await admin.from('picks').delete().eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (type === 'all') {
    await admin.from('bracket_entries').delete().eq('user_id', userId)
    await admin.from('picks').delete().eq('user_id', userId)
    await admin.from('global_scores').delete().eq('user_id', userId)
  }

  return NextResponse.json({ ok: true })
}
