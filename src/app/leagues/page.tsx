import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import JoinLeagueForm from './JoinLeagueForm'

export default async function LeaguesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: memberships } = await supabase
    .from('league_members')
    .select('league:leagues(id, name, description, invite_code, commissioner_id, created_at, member_count:league_members(count))')
    .eq('user_id', user.id)

  const leagues = memberships?.map(m => m.league).filter(Boolean) ?? []

  return (
    <AppShell>
      <div style={{ paddingBottom: 28 }}>
        <div style={{ padding: '8px 20px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="wc-eyebrow">PRIVATE COMPETITION</div>
            <h1 className="wc-title">My Leagues</h1>
          </div>
          <Link
            href="/leagues/create"
            style={{
              textDecoration: 'none', padding: '8px 16px', borderRadius: 12,
              background: 'var(--accent)', color: '#fff',
              fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 13,
            }}
          >
            + Create
          </Link>
        </div>

        {/* Join league */}
        <div style={{ margin: '0 20px 20px', padding: '16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.8, color: 'var(--ink-3)', marginBottom: 10 }}>
            JOIN WITH CODE
          </div>
          <JoinLeagueForm userId={user.id} />
        </div>

        {leagues.length === 0 ? (
          <div style={{ margin: '12px 20px', padding: '32px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 18 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏟️</div>
            <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>No leagues yet</div>
            <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              Create one or ask a friend for their invite code
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
            {leagues.map((league: any) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                style={{
                  textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '14px 16px',
                  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
                  boxShadow: '0 1px 2px rgba(20,22,40,0.04)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                    {league.name}
                  </div>
                  {league.description && (
                    <div style={{ fontFamily: 'var(--f-body)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {league.description}
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>
                    {league.member_count?.[0]?.count ?? 0} members · CODE: {league.invite_code}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6"/>
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
