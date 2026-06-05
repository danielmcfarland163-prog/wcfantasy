import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import Link from 'next/link'
import JoinLeagueForm from './JoinLeagueForm'

export default async function LeaguesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Get user's leagues with member count + their score
  const { data: memberships } = await supabase
    .from('league_members')
    .select(`
      league:leagues(
        id, name, description, invite_code, commissioner_id, created_at,
        member_count:league_members(count)
      )
    `)
    .eq('user_id', user.id)

  const leagues = memberships?.map(m => m.league).filter(Boolean) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav username={profile?.username ?? 'you'} />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">👥 My Leagues</h1>
          <Link href="/leagues/create" className="btn-primary">
            + Create league
          </Link>
        </div>

        {/* Join league */}
        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Join a league</h2>
          <JoinLeagueForm userId={user.id} />
        </div>

        {/* League list */}
        {leagues.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">🏟️</div>
            <p className="font-medium text-gray-600">No leagues yet</p>
            <p className="text-sm mt-1">Create one or ask a friend for their invite code.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leagues.map((league: any) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="card p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="font-semibold text-gray-900">{league.name}</div>
                  {league.description && (
                    <div className="text-sm text-gray-500 mt-0.5">{league.description}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {league.member_count?.[0]?.count ?? 0} members · Code: {league.invite_code}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
