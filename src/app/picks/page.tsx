import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import PicksClient from './PicksClient'
import type { MatchWithPick } from '@/lib/types'
import { isMatchLocked } from '@/lib/utils'
import { format } from 'date-fns'

export default async function PicksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .order('kickoff_time', { ascending: true })

  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)

  const { data: myScore } = await supabase
    .from('global_scores')
    .select('total_points, global_rank, correct_results')
    .eq('user_id', user.id)
    .single()

  const picksByMatch = Object.fromEntries((picks ?? []).map(p => [p.match_id, p]))
  const matchesWithPicks: MatchWithPick[] = (matches ?? []).map(m => ({
    ...m,
    userPick: picksByMatch[m.id],
    isLocked: isMatchLocked(m.kickoff_time),
  }))

  // Each picks row represents a saved scoreline prediction
  const totalPicked = (picks ?? []).length

  return (
    <AppShell>
      <div style={{ paddingBottom: 28 }}>
        {/* Header */}
        <div style={{ padding: '8px 20px 14px' }}>
          <div className="wc-eyebrow">FAN PICKS</div>
          <h1 className="wc-title">My Predictions</h1>
        </div>

        {/* Stat header card */}
        <div style={{
          margin: '0 20px',
          borderRadius: 20,
          padding: '18px 18px 16px',
          color: '#fff',
          background: 'linear-gradient(135deg, var(--navy), color-mix(in srgb, var(--navy) 65%, var(--accent)))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>GLOBAL RANK</div>
              <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                {myScore?.global_rank ? `#${myScore.global_rank}` : '—'}
              </div>
              <div style={{ fontFamily: 'var(--f-body)', fontSize: 11.5, opacity: 0.75 }}>
                {myScore ? `${myScore.total_points} pts · ${myScore.correct_results} correct` : 'Make picks to start scoring'}
              </div>
            </div>
            <div style={{ width: 1, height: 48, background: 'rgba(255,255,255,0.18)' }} />
            <div style={{ textAlign: 'center', paddingLeft: 4 }}>
              <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 28, color: '#fff' }}>
                {totalPicked}
              </div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, letterSpacing: 0.5, opacity: 0.7 }}>
                PICKS MADE
              </div>
            </div>
          </div>
        </div>

        <PicksClient userId={user.id} initialMatches={matchesWithPicks} />
      </div>
    </AppShell>
  )
}
