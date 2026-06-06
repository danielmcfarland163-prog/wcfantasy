import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { invite_code } = await req.json()
    if (!invite_code) return NextResponse.json({ error: 'Missing invite code' }, { status: 400 })

    // Get authenticated user from session
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Use admin client to bypass RLS — non-members can't SELECT private leagues
    const admin = createAdminSupabaseClient()

    const { data: league, error: leagueErr } = await admin
      .from('leagues')
      .select('id, name, max_members')
      .eq('invite_code', invite_code.trim().toUpperCase())
      .single()

    if (leagueErr || !league) {
      return NextResponse.json({ error: 'League not found. Check the invite code.' }, { status: 404 })
    }

    // Check membership count against max
    const { count } = await admin
      .from('league_members')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.id)

    if (count !== null && count >= (league.max_members ?? 50)) {
      return NextResponse.json({ error: 'This league is full.' }, { status: 409 })
    }

    // Insert member
    const { error: joinErr } = await admin
      .from('league_members')
      .insert({ league_id: league.id, user_id: user.id })

    if (joinErr) {
      if (joinErr.code === '23505') {
        return NextResponse.json({ error: "You're already in this league!" }, { status: 409 })
      }
      return NextResponse.json({ error: 'Could not join league. Try again.' }, { status: 500 })
    }

    // Upsert league_scores row
    await admin.from('league_scores').upsert(
      { league_id: league.id, user_id: user.id, total_points: 0 },
      { onConflict: 'league_id,user_id' }
    )

    return NextResponse.json({ leagueId: league.id })
  } catch (e) {
    console.error('join-league error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
