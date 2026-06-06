import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import OnboardingForm from './OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, onboarded')
    .eq('id', user.id)
    .single()

  // Already set up — straight to the app.
  if (profile?.onboarded) redirect('/today')

  // Suggest the auto-generated username (email prefix) as a starting point.
  const suggested =
    profile?.username && !profile.username.includes('@') ? profile.username : ''

  return <OnboardingForm userId={user.id} email={user.email ?? ''} initialUsername={suggested} />
}
