import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Routes reachable without an authenticated, fully-onboarded user.
const PUBLIC_PREFIXES = ['/auth', '/join']

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // IMPORTANT: this response object is what carries refreshed auth cookies back
  // to the browser. We must keep mutating *this* instance (not a fresh one) so
  // the rotated session token persists across reloads.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session cookie on every request → session survives reloads.
  const { data: { user } } = await supabase.auth.getUser()

  const needsOnboarding = !!user && user.user_metadata?.onboarded !== true

  if (isPublicPath(pathname)) {
    // A signed-in but not-yet-onboarded user landing on "/" gets nudged into setup.
    // (Auth + invite routes are left alone so the flow itself can complete.)
    if (needsOnboarding && pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/onboarding'
      return NextResponse.redirect(url)
    }
    return response
  }

  // Protected route, no session → send to login.
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  // Protected route, signed in but profile not set up → finish onboarding first.
  if (needsOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/onboarding'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Run on everything except static assets and API routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
