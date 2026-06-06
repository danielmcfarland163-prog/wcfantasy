import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import AccountMenu from '@/components/AccountMenu'
import MatchRow from '@/components/MatchRow'
import LiveHero from '@/components/LiveHero'
import LiveDot from '@/components/ui/LiveDot'
import Flag, { isoForTeam } from '@/components/ui/Flag'
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
    displayTime: m.kickoff_time
      ? format(new Date(m.kickoff_time), 'h:mm a')
      : undefined,
  }
}

export default async function TodayPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  // All matches today (UTC) + any currently live
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)

  const { data: todayMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .gte('kickoff_time', todayStart.toISOString())
    .lte('kickoff_time', todayEnd.toISOString())
    .order('kickoff_time')

  const { data: liveMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('status', 'LIVE')

  // User's global score
  const { data: myScore } = await supabase
    .from('global_scores')
    .select('total_points, global_rank')
    .eq('user_id', user.id)
    .single()

  // Top 3 leaderboard
  const { data: topScores } = await supabase
    .from('global_scores')
    .select('total_points, global_rank, profile:profiles(username)')
    .order('total_points', { ascending: false })
    .limit(3)

  // User's bracket completeness
  const { data: bracketEntry } = await supabase
    .from('bracket_entries')
    .select('final_pick')
    .eq('user_id', user.id)
    .single()

  const live = (liveMatches ?? []).map(matchToRow)
  const today = (todayMatches ?? []).map(matchToRow)
  const upcoming = today.filter(m => m.status === 'SCHEDULED' || m.status === 'UPCOMING')
  const finished = today.filter(m => m.status === 'FT' || m.status === 'FINISHED')

  const hasLive = live.length > 0
  const hasToday = today.length > 0

  return (
    <AppShell>
      <div style={{ paddingBottom: 28 }}>
        {/* Header */}
        <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="wc-eyebrow">
              {hasLive ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <LiveDot size={6} />
                  {live.length} LIVE NOW
                </span>
              ) : 'WORLD CUP 2026 · GROUPS'}
            </div>
            <h1 className="wc-title">Today</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href="/leagues"
              className="wc-icon-btn"
              style={{ textDecoration: 'none' }}
              title="My Leagues"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </Link>
            <AccountMenu username={profile?.username} />
          </div>
        </div>

        {/* Live now */}
        {hasLive && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 20px 12px' }}>
              <h2 className="wc-section-head">{live.length} Live now</h2>
            </div>
            <div
              className="wc-noscroll"
              style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 4px', scrollSnapType: 'x mandatory' }}
            >
              {live.map(m => <LiveHero key={m.id} match={m} />)}
            </div>
          </>
        )}

        {/* Coming up */}
        {upcoming.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 20px 12px' }}>
              <h2 className="wc-section-head">Coming up</h2>
              <Link href="/bracket" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
                Schedule ›
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
              {upcoming.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          </>
        )}

        {/* No matches today */}
        {!hasToday && !hasLive && (
          <div style={{ margin: '40px 20px', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚽</div>
            <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 18, color: 'var(--ink-2)' }}>No matches today</div>
            <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, marginTop: 4 }}>
              The tournament starts June 11 · USA • Canada • Mexico
            </div>
          </div>
        )}

        {/* Leaderboard mini */}
        {(topScores?.length ?? 0) > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 20px 12px' }}>
              <h2 className="wc-section-head">🏆 Leaderboard</h2>
              <Link href="/stats" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
                Full table ›
              </Link>
            </div>
            <div style={{ margin: '0 20px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              {(topScores ?? []).map((s: any, i: number) => {
                const isMe = s.user_id === user.id
                const medals = ['🥇', '🥈', '🥉']
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px',
                    borderTop: i ? '1px solid var(--line)' : 'none',
                    background: isMe ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'var(--surface)',
                  }}>
                    <span style={{ width: 22, textAlign: 'center', fontSize: 16 }}>{medals[i] ?? i + 1}</span>
                    <span style={{ flex: 1, fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                      {s.profile?.username ?? 'Unknown'}
                      {isMe && <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--accent)', marginLeft: 6 }}>YOU</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
                      {s.total_points}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Earlier results */}
        {finished.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 20px 12px' }}>
              <h2 className="wc-section-head">Earlier results</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
              {finished.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          </>
        )}

        {/* Bracket CTA */}
        <div style={{ margin: '22px 20px 0' }}>
          <Link
            href="/bracket"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              width: '100%', textDecoration: 'none', borderRadius: 18, padding: '16px 18px',
              background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, var(--win)))',
              color: '#fff',
              boxShadow: '0 12px 24px -12px var(--accent)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.95 }}>
              <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 17 }}>
                {bracketEntry?.final_pick
                  ? `Champion pick: ${bracketEntry.final_pick}`
                  : 'Fill your bracket'}
              </div>
              <div style={{ fontFamily: 'var(--f-body)', fontSize: 12.5, opacity: 0.9 }}>
                {myScore?.global_rank
                  ? `You're #${myScore.global_rank} · ${myScore.total_points} pts`
                  : 'Picks lock June 11 · USA • Canada • Mexico'}
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
