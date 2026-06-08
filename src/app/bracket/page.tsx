import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import BracketModes from './BracketModes'
import { dbToState, EMPTY_STATE } from '@/lib/bracket'

export default async function BracketPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Two independent entries per user — one row per mode (pickem / reset).
  const { data: entries } = await supabase
    .from('bracket_entries')
    .select('*')
    .eq('user_id', user.id)

  const { data: results } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('id', 1)
    .single()

  const byMode = (m: string) => (entries ?? []).find((e: any) => e.mode === m)
  const pickemRow = byMode('pickem')
  const resetRow = byMode('reset')
  const pickemState = pickemRow ? dbToState(pickemRow) : EMPTY_STATE
  const resetState = resetRow ? dbToState(resetRow) : EMPTY_STATE
  const hasResults = !!(results?.group_results && Object.keys(results.group_results).length > 0)

  return (
    <AppShell>
      <div style={{ padding: '8px 20px 14px' }}>
        <h1 className="wc-title">My Bracket</h1>
      </div>
      <div style={{ padding: '0 20px' }}>
        <BracketModes
          userId={user.id}
          pickemState={pickemState}
          resetState={resetState}
          tournamentResults={hasResults ? results : null}
        />
      </div>
    </AppShell>
  )
}
