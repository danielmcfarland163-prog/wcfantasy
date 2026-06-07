import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BASE = '/soccer-fantasy'

// Handles the redirect target of magic links and email confirmations.
// Exchanges the one-time code for a session, then routes the user to
// onboarding (first time) or straight into the app.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const onboarded = data.session?.user?.user_metadata?.onboarded === true
      const dest = !onboarded
        ? `${BASE}/auth/onboarding`
        : next ?? `${BASE}/today`
      return NextResponse.redirect(`${origin}${dest}`)
    }
  }

  // Code missing or exchange failed (expired/invalid link).
  return NextResponse.redirect(`${origin}${BASE}/auth/login?error=link`)
}
