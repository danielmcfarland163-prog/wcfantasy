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

export async function GET(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, username, display_name, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { email, password, username, display_name } = await req.json()
  if (!email || !password || !username) {
    return NextResponse.json({ error: 'email, password, and username are required' }, { status: 400 })
  }
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: display_name || username },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, user: data.user })
}

export async function DELETE(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId } = await req.json()
  const admin = createAdminSupabaseClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
