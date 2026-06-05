export const runtime = 'edge'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import PicksClient from './PicksClient'
import type { Match, Pick, Team } from '@/lib/types'
import { isMatchLocked } from '@/lib/utils'


export default async function PicksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch matches with teams
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*)
    `)
    .order('kickoff_time', { ascending: true })

  // Fetch user's picks
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)

  // Merge picks into matches
  const picksMap = new Map((picks ?? []).map(p => [p.match_id, p]))
  const matchesWithPicks = (matches ?? []).map(m => ({
    ...m,
    userPick: picksMap.get(m.id) ?? undefined,
    isLocked: isMatchLocked(m.kickoff_time),
  }))

  // User's summary stats
  const totalPoints = (picks ?? []).reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  const exactScores = (picks ?? []).filter(p => p.pick_result === 'EXACT').length
  const correctResults = (picks ?? []).filter(p => p.pick_result === 'CORRECT' || p.pick_result === 'EXACT').length
  const totalPicked = (picks ?? []).filter(p => p.match_id).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav username={profile?.username ?? 'you'} />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Stats banner */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Points', value: totalPoints, color: 'text-green-700' },
            { label: 'Picked', value: totalPicked, color: 'text-gray-700' },
            { label: 'Correct', value: correctResults, color: 'text-blue-700' },
            { label: 'Exact', value: exactScores, color: 'text-emerald-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-3 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <PicksClient userId={user.id} initialMatches={matchesWithPicks} />
      </main>
    </div>
  )
}
