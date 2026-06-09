import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Invite-link landing. The "Copy invite" button shares /join/<CODE>; this turns
// that link into an actual join. /join is a public route (see middleware), so we
// gate auth here and bounce un-signed-in / un-onboarded visitors through the auth
// flow, returning them to this same link afterwards via ?next.
export const dynamic = 'force-dynamic'

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const inviteCode = decodeURIComponent(code).trim().toUpperCase()
  const nextPath = `/join/${encodeURIComponent(inviteCode)}`

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`)
  if (user.user_metadata?.onboarded !== true) redirect(`/auth/onboarding?next=${encodeURIComponent(nextPath)}`)

  // Service-role client: non-members can't SELECT a private league, and inserting a
  // membership / seeding the standings row both bypass RLS the same way the
  // /api/join-league route does. Returns null if the service key isn't configured.
  const admin = (() => {
    try { return createAdminSupabaseClient() } catch { return null }
  })()
  if (!admin) {
    return <JoinCard emoji="🛠" title="Joining is unavailable" body="The server isn't fully configured to accept invites right now. Please try again later." />
  }

  const { data: league } = await admin
    .from('leagues')
    .select('id, name, max_members')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (!league) {
    return <JoinCard emoji="🔗" title="Invite not found" body={`We couldn't find a league for code "${inviteCode}". The link may be mistyped or the league may have been deleted — ask for a fresh invite.`} />
  }

  // Already in it → straight to the league.
  const { data: existing } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', league.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) redirect(`/leagues/${league.id}`)

  // Capacity check (mirror /api/join-league).
  const { count } = await admin
    .from('league_members')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', league.id)
  if (count !== null && count >= (league.max_members ?? 50)) {
    return <JoinCard emoji="🚪" title="This league is full" body={`"${league.name}" has reached its member limit, so no new members can join right now.`} />
  }

  const { error: joinErr } = await admin
    .from('league_members')
    .insert({ league_id: league.id, user_id: user.id })
  // 23505 = unique violation = already a member (race) — treat as success.
  if (joinErr && joinErr.code !== '23505') {
    return <JoinCard emoji="⚠️" title="Couldn't join" body={`Something went wrong joining "${league.name}". Please try the link again.`} />
  }

  await admin
    .from('league_scores')
    .upsert({ league_id: league.id, user_id: user.id, total_points: 0 }, { onConflict: 'league_id,user_id' })

  redirect(`/leagues/${league.id}`)
}

function JoinCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 420, width: '100%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px 28px', textAlign: 'center', boxShadow: '0 20px 48px -24px rgba(20,22,40,0.35)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</div>
        <h1 style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontFamily: 'var(--f-body)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 22px' }}>{body}</p>
        <Link href="/leagues" style={{ display: 'inline-block', textDecoration: 'none', padding: '12px 22px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 15 }}>
          Go to my leagues
        </Link>
      </div>
    </div>
  )
}
