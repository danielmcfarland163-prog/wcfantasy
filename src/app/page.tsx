import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/today')

  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #0d1a2e 0%, #1a2f4e 50%, #0d2215 100%)',
      maxWidth: 480, margin: '0 auto',
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 28px', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🌍⚽🏆</div>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            USA · CANADA · MEXICO
          </div>
          <h1 style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 44, letterSpacing: -0.5, color: '#fff', margin: '0 0 8px' }}>
            Soccer Fantasy<br />Game
          </h1>
          <p style={{ fontFamily: 'var(--f-body)', fontSize: 15, color: 'rgba(255,255,255,0.7)', maxWidth: 280, margin: '0 auto 36px' }}>
            Fill your bracket, pick match winners, climb the leaderboard, trash talk your friends.
          </p>
          <Link
            href="/auth/login"
            style={{
              display: 'inline-block', textDecoration: 'none',
              background: 'var(--accent)', color: '#fff',
              fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18,
              padding: '14px 40px', borderRadius: 16,
              boxShadow: '0 12px 28px -10px var(--accent)',
            }}
          >
            Play for free →
          </Link>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 32, maxWidth: 320, margin: '32px auto 0' }}>
            {[
              { icon: '🗂', title: 'Full bracket picks', desc: 'Groups to Final' },
              { icon: '🏆', title: 'Live leaderboard', desc: 'Updates as results come in' },
              { icon: '👥', title: 'Private leagues', desc: 'Invite your crew' },
              { icon: '🔒', title: 'Locks June 11', desc: 'Set your picks now' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 12px', textAlign: 'left',
              }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
                <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 14, color: '#fff' }}>{title}</div>
                <div style={{ fontFamily: 'var(--f-body)', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <footer style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--f-mono)', fontSize: 10, padding: '0 0 24px' }}>
        NOT AFFILIATED WITH FIFA · BUILT FOR FUN
      </footer>
    </div>
  )
}
