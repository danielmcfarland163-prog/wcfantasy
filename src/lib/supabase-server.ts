// Server-side Supabase client (for Server Components, API routes)
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // In Server Components the cookie store is read-only and .set() throws.
          // Session refresh is handled in middleware, so it's safe to ignore here.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Admin client - uses the service role / secret key, bypasses RLS.
// ONLY use in server-side API routes, never expose to the client.
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Fail loudly with an actionable message. Without this, a missing or
  // placeholder key silently produces an unauthenticated client and every
  // query returns 401, which surfaces in the UI as a vague "API not working".
  if (!url) {
    throw new Error('Supabase admin client misconfigured: NEXT_PUBLIC_SUPABASE_URL is not set.')
  }
  const looksValid = key && !key.startsWith('PASTE_') && (key.startsWith('sb_secret_') || key.startsWith('eyJ'))
  if (!looksValid) {
    throw new Error(
      'Supabase admin client misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing or a placeholder. ' +
      'Set it to the project secret key (sb_secret_...) in .env.local for local dev, and on the ' +
      'deployed Worker via: wrangler secret put SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, key as string, { auth: { persistSession: false } })
}
