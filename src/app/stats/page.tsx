import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StatsClient from './StatsClient'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import { computeGroupStandings } from '@/lib/standings'

export default async function StatsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: scores } = await supabase
    .from('global_scores')
    .select('user_id, total_points, picks_points, bracket_points, picks_correct, bracket_correct, correct_results, picks_made, global_rank, profile:profiles(username, display_name)')
    .limit(100)

  // Live group standings, computed from group-stage match results.
  const { data: groupMatches } = await supabase
    .from('matches')
    .select('group_letter, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(id, name, short_code), away_team:teams!matches_away_team_id_fkey(id, name, short_code)')
    .eq('stage', 'GROUP')

  const standings = computeGroupStandings((groupMatches ?? []) as any)

  return (
    <AppShell>
      <RealtimeRefresh tables={['global_scores', 'matches']} />
      <StatsClient scores={(scores ?? []) as any} userId={user.id} standings={standings} />
    </AppShell>
  )
}
