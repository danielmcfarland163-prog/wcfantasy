import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import BracketClient from './BracketClient'
import { dbToState, isLocked, EMPTY_STATE } from '@/lib/bracket'

export default async function BracketPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: entry } = await supabase
    .from('bracket_entries')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: results } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('id', 1)
    .single()

  const initialState = entry ? dbToState(entry) : EMPTY_STATE
  const locked = isLocked()
  const hasResults = !!(results?.group_results && Object.keys(results.group_results).length > 0)

  return (
    <AppShell>
      <div style={{ padding: '8px 20px 14px' }}>
        <div className="wc-eyebrow">THE ROAD TO METLIFE</div>
        <h1 className="wc-title">My Bracket</h1>
        {locked && (
          <div style={{
            marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'color-mix(in srgb, var(--gold) 12%, var(--surface))',
            border: '1px solid color-mix(in srgb, var(--gold) 35%, var(--line))',
            borderRadius: 8, padding: '4px 10px',
            fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, color: 'var(--gold)',
          }}>
            🔒 Picks locked · tournament in progress
          </div>
        )}
      </div>
      <div style={{ padding: '0 20px' }}>
        <BracketClient userId={user.id} initialState={initialState} tournamentResults={hasResults ? results : null} />
      </div>
    </AppShell>
  )
}
