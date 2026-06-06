import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import AdminClient from './AdminClient'
import { ADMIN_USER_IDS } from '@/lib/admin'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  if (!ADMIN_USER_IDS.includes(user.id)) redirect('/today')

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .order('kickoff_time', { ascending: true })
    .limit(100)

  const admin = createAdminSupabaseClient()

  const { count: userCount } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: bracketCount } = await admin
    .from('bracket_entries')
    .select('*', { count: 'exact', head: true })

  return (
    <AppShell>
      <div style={{ padding: '8px 20px 14px' }}>
        <div className="wc-eyebrow">STAFF ONLY</div>
        <h1 className="wc-title">Admin</h1>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '0 20px 24px' }}>
        {[
          { label: 'Players', value: userCount ?? 0 },
          { label: 'Brackets', value: bracketCount ?? 0 },
          { label: 'Matches', value: matches?.length ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 26, color: 'var(--ink)' }}>{value}</div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, letterSpacing: 0.8, color: 'var(--ink-3)', marginTop: 2 }}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <AdminClient initialMatches={matches ?? []} />
    </AppShell>
  )
}
