export const runtime = 'edge'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import type { GlobalScore } from '@/lib/types'


export default async function LeaderboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: scores } = await supabase
    .from('global_scores')
    .select('*, profile:profiles(username, display_name, avatar_url)')
    .order('total_points', { ascending: false })
    .limit(100)

  const myRank = scores?.findIndex(s => s.user_id === user.id) ?? -1
  const myScore = scores?.[myRank]

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav username={profile?.username ?? 'you'} />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🏆 Global Leaderboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">{scores?.length ?? 0} players worldwide</p>
          </div>
          {myRank >= 0 && (
            <div className="card px-4 py-2 text-center">
              <div className="text-xs text-gray-500">Your rank</div>
              <div className="text-2xl font-bold text-green-700">#{myRank + 1}</div>
              <div className="text-xs text-gray-500">{myScore?.total_points ?? 0} pts</div>
            </div>
          )}
        </div>

        {/* Podium (top 3) */}
        {scores && scores.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-6">
            {/* 2nd */}
            <PodiumCard score={scores[1]} rank={2} />
            {/* 1st */}
            <PodiumCard score={scores[0]} rank={1} featured />
            {/* 3rd */}
            <PodiumCard score={scores[2]} rank={3} />
          </div>
        )}

        {/* Full table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Player</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Pts</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">Correct</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">Exact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(scores ?? []).map((score, i) => {
                const isMe = score.user_id === user.id
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                return (
                  <tr
                    key={score.user_id}
                    className={`hover:bg-gray-50 transition-colors ${isMe ? 'bg-green-50 font-semibold' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {medal ?? <span className="text-gray-400">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 uppercase">
                          {score.profile?.username?.[0] ?? '?'}
                        </div>
                        <span className={isMe ? 'text-green-800' : 'text-gray-900'}>
                          {score.profile?.display_name ?? score.profile?.username ?? 'Unknown'}
                          {isMe && <span className="ml-1 text-xs text-green-600">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{score.total_points}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{score.correct_results}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{score.exact_scores}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

function PodiumCard({ score, rank, featured }: { score: GlobalScore; rank: number; featured?: boolean }) {
  const medals = ['🥇', '🥈', '🥉']
  const heights = ['h-16', 'h-20', 'h-12']
  return (
    <div className={`flex-1 max-w-[120px] text-center ${featured ? 'scale-105' : ''}`}>
      <div className="text-2xl mb-1">{medals[rank - 1]}</div>
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 uppercase mx-auto mb-1">
        {score.profile?.username?.[0] ?? '?'}
      </div>
      <div className="text-xs font-semibold text-gray-800 truncate">
        {score.profile?.display_name ?? score.profile?.username ?? '?'}
      </div>
      <div className="text-sm font-bold text-green-700">{score.total_points} pts</div>
      <div className={`bg-green-600 rounded-t-lg mt-2 ${heights[rank - 1]}`} />
    </div>
  )
}
