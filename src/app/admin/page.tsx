export const runtime = 'edge'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import AdminClient from './AdminClient'

// IMPORTANT: Add your user ID to this list to grant admin access
const ADMIN_USER_IDS: string[] = [
  // 'your-supabase-user-uuid-here',
]

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  if (!ADMIN_USER_IDS.includes(user.id)) {
    redirect('/picks')
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .order('kickoff_time', { ascending: true })
    .limit(50)

  const { data: stats } = await supabase.from('global_scores').select('user_id')
  const userCount = stats?.length ?? 0

  const { data: pickCount } = await supabase.from('picks').select('id', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav username={profile?.username ?? 'admin'} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">⚙️ Admin</h1>
          <span className="badge bg-red-100 text-red-700">Staff only</span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{userCount}</div>
            <div className="text-xs text-gray-500">Total players</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{(pickCount as any)?.count ?? 0}</div>
            <div className="text-xs text-gray-500">Total picks</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{matches?.length ?? 0}</div>
            <div className="text-xs text-gray-500">Matches loaded</div>
          </div>
        </div>

        <AdminClient initialMatches={matches ?? []} />
      </main>
    </div>
  )
}
