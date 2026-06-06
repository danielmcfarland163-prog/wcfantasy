import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import LeagueClient from './LeagueClient'
import { generateInviteUrl } from '@/lib/utils'

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: membership } = await supabase
    .from('league_members').select('*')
    .eq('league_id', id).eq('user_id', user.id).single()
  if (!membership) notFound()

  const { data: league } = await supabase
    .from('leagues').select('*').eq('id', id).single()
  if (!league) notFound()

  const { data: scores } = await supabase
    .from('league_scores')
    .select('*, profile:profiles(username, display_name)')
    .eq('league_id', id)
    .order('total_points', { ascending: false })

  const { data: members } = await supabase
    .from('league_members').select('user_id').eq('league_id', id)
  const memberIds = (members ?? []).map((m: any) => m.user_id)

  const { data: bracketEntries } = await supabase
    .from('bracket_entries')
    .select('*, profile:profiles(username, display_name)')
    .in('user_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: tournamentResults } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('id', 1)
    .single()

  const inviteUrl = generateInviteUrl(league.invite_code)

  return (
    <AppShell>
      <LeagueClient
        league={league}
        scores={scores ?? []}
        bracketEntries={bracketEntries ?? []}
        currentUserId={user.id}
        currentProfile={profile}
        inviteUrl={inviteUrl}
        tournamentResults={tournamentResults ?? null}
      />
    </AppShell>
  )
}
