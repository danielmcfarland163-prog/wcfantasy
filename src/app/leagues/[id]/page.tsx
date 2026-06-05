export const runtime = 'edge'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import LeagueChat from '@/components/LeagueChat'
import Link from 'next/link'
import { generateInviteUrl } from '@/lib/utils'


export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Verify user is a member
  const { data: membership } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', id)
    .eq('user_id', user.id)
    .single()

  if (!membership) notFound()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', id)
    .single()

  if (!league) notFound()

  // Standings
  const { data: scores } = await supabase
    .from('league_scores')
    .select('*, profile:profiles(username, display_name)')
    .eq('league_id', id)
    .order('total_points', { ascending: false })

  const isCommissioner = league.commissioner_id === user.id
  const inviteUrl = generateInviteUrl(league.invite_code)

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav username={profile?.username ?? 'you'} />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <Link href="/leagues" className="text-sm text-gray-400 hover:text-gray-600">← Leagues</Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{league.name}</h1>
            {league.description && <p className="text-gray-500 text-sm mt-0.5">{league.description}</p>}
          </div>
          {/* Invite card */}
          <div className="card p-3 text-center shrink-0">
            <div className="text-xs text-gray-500 mb-1">Invite code</div>
            <div className="font-mono text-lg font-bold text-green-700 tracking-widest">
              {league.invite_code}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-1"
            >
              Copy link
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Standings */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Standings</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Player</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Pts</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">±</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(scores ?? []).map((score, i) => {
                    const isMe = score.user_id === user.id
                    return (
                      <tr key={score.user_id} className={`hover:bg-gray-50 ${isMe ? 'bg-green-50 font-semibold' : ''}`}>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td className="px-4 py-2.5 text-gray-900">
                          {score.profile?.display_name ?? score.profile?.username}
                          {isMe && <span className="ml-1 text-xs text-green-600">(you)</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold">{score.total_points}</td>
                        <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                          <span className={`text-xs ${score.rank_change > 0 ? 'text-green-600' : score.rank_change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {score.rank_change > 0 ? `▲${score.rank_change}` : score.rank_change < 0 ? `▼${Math.abs(score.rank_change)}` : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chat */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">💬 Trash talk</h2>
            <LeagueChat leagueId={id} userId={user.id} username={profile?.username ?? 'you'} />
          </div>
        </div>
      </main>
    </div>
  )
}
