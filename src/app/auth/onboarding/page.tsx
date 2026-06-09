import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import OnboardingForm from './OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  // Same-origin, app-relative return path (e.g. an invite link); open-redirect-safe.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, onboarded')
    .eq('id', user.id)
    .single()

  // Already set up — on to the return path (or the app).
  if (profile?.onboarded) redirect(safeNext ?? '/today')

  // Suggest the auto-generated username (email prefix) as a starting point.
  const suggested =
    profile?.username && !profile.username.includes('@') ? profile.username : ''

  return <OnboardingForm userId={user.id} email={user.email ?? ''} initialUsername={suggested} next={safeNext} />
}
