import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/picks')

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4 text-center">
        <div>
          <div className="text-7xl mb-4">🌍⚽🏆</div>
          <h1 className="text-5xl font-bold text-white mb-4">World Cup Fantasy</h1>
          <p className="text-xl text-green-100 mb-3">2026 Edition · USA • Canada • Mexico</p>
          <p className="text-green-200 max-w-md mx-auto mb-10">
            Pick exact scores for every match, climb the leaderboard, trash talk your friends in private leagues.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/login" className="btn-primary px-8 py-3 text-base">
              Play for free →
            </Link>
          </div>

          {/* Feature bullets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16 text-left max-w-2xl mx-auto">
            {[
              { icon: '⚽', title: 'Pick every match', desc: 'Exact scores earn bonus points' },
              { icon: '🏆', title: 'Live leaderboard', desc: 'Updates after every goal' },
              { icon: '👥', title: 'Private leagues', desc: 'Invite your crew, trash talk freely' },
              { icon: '🔔', title: 'Reminders', desc: 'Email alerts before matches lock' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white/10 rounded-xl p-4 text-white">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="font-semibold text-sm">{title}</div>
                <div className="text-green-200 text-xs mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="text-center text-green-400 text-xs pb-6">
        Not affiliated with FIFA. Built for fun.
      </footer>
    </div>
  )
}
