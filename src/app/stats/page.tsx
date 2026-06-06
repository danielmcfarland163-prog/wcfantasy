import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StatsClient from './StatsClient'

export default async function StatsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: scores } = await supabase
    .from('global_scores')
    .select('user_id, total_points, picks_points, bracket_points, picks_correct, bracket_correct, correct_results, picks_made, global_rank, profile:profiles(username, display_name)')
    .limit(100)

  return (
    <AppShell>
      <StatsClient scores={(scores ?? []) as any} userId={user.id} />
    </AppShell>
  )
}
