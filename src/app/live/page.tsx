import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import LiveHero from '@/components/LiveHero'
import MatchRow from '@/components/MatchRow'
import LiveDot from '@/components/ui/LiveDot'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import type { MatchRowData } from '@/components/MatchRow'
import { format } from 'date-fns'

function matchToRow(m: any): MatchRowData {
  return {
    id: m.id,
    homeTeam: { name: m.home_team?.name ?? 'TBD', shortCode: m.home_team?.short_code ?? '???' },
    awayTeam: { name: m.away_team?.name ?? 'TBD', shortCode: m.away_team?.short_code ?? '???' },
    homeScore: m.home_score,
    awayScore: m.away_score,
    status: m.status,
    stage: m.stage,
    displayTime: m.kickoff_time ? format(new Date(m.kickoff_time), 'h:mm a') : undefined,
  }
}

export default async function LivePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: liveMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('status', 'LIVE')
    .order('kickoff_time')

  const { data: recentMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .in('status', ['FINISHED'])
    .order('kickoff_time', { ascending: false })
    .limit(8)

  const live = (liveMatches ?? []).map(matchToRow)
  const recent = (recentMatches ?? []).map(matchToRow)

  return (
    <AppShell>
      <RealtimeRefresh tables={['matches']} />
      <div style={{ paddingBottom: 28 }}>
        {/* Header */}
        <div style={{ padding: '8px 20px 8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} className="wc-eyebrow">
            {live.length > 0 && <LiveDot size={6} />}
            IN PROGRESS NOW
          </div>
          <h1 className="wc-title">Live</h1>
        </div>

        {live.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 20px 0' }}>
            {live.map(m => <LiveHero key={m.id} match={m} stacked />)}
          </div>
        ) : (
          <div style={{ margin: '32px 20px', padding: '32px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>No live matches</div>
            <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              Check back during the tournament · kick-off June 11
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <>
            <div style={{ margin: '22px 20px 12px' }}>
              <h2 className="wc-section-head">Just finished</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
              {recent.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
