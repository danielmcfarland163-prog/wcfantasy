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

  const inviteUrl = generateInviteUrl(league.invite_code)

  return (
    <AppShell>
      <LeagueClient
        league={league}
        scores={scores ?? []}
        currentUserId={user.id}
        currentProfile={profile}
        inviteUrl={inviteUrl}
      />
    </AppShell>
  )
}
