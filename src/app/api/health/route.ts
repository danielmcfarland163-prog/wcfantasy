// GET|POST /api/health
// Runtime readiness probe for the deployed app Worker. Reports, for every secret
// the app's API routes depend on, whether it is PRESENT and whether it LOOKS VALID
// — never the value itself. This is the verification half of blocker B3
// ("runtime secrets set manually and unverified"): after a deploy, hit this route
// to confirm SUPABASE_SERVICE_ROLE_KEY / FOOTBALL_DATA_API_KEY / CRON_SECRET /
// RESEND_* are actually wired on the Worker, instead of discovering a missing
// secret as a 500 from sync-fixtures / score-picks / join-league in production.
//
// Auth: CRON_SECRET bearer (server-to-server) OR an admin session — same gate as
// the cron/admin routes. Gating it prevents leaking the app's configuration shape.
// Note: it deliberately does NOT construct the admin Supabase client, so it still
// answers (and reports the problem) even when SUPABASE_SERVICE_ROLE_KEY is unset.

import { NextRequest, NextResponse } from 'next/server'
import { isCronOrAdmin } from '@/lib/api-auth'

type Check = { present: boolean; looksValid: boolean; note?: string }

// Mirrors the validity heuristic in createAdminSupabaseClient() so "looksValid"
// here means the same thing the admin client will accept at call time.
function serviceRoleValid(v: string | undefined): boolean {
  return !!v && !v.startsWith('PASTE_') && (v.startsWith('sb_secret_') || v.startsWith('eyJ'))
}

function check(v: string | undefined, looksValid: (s: string) => boolean, note?: string): Check {
  const present = !!v && v.length > 0
  return { present, looksValid: present && looksValid(v as string), ...(note ? { note } : {}) }
}

async function handler(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const e = process.env

  // Required for admin/cron/scoring/join routes to function at all.
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: check(e.NEXT_PUBLIC_SUPABASE_URL, (s) => s.startsWith('https://') && s.includes('.supabase.co')),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: check(e.NEXT_PUBLIC_SUPABASE_ANON_KEY, (s) => s.startsWith('sb_publishable_') || s.startsWith('eyJ')),
    SUPABASE_SERVICE_ROLE_KEY: check(e.SUPABASE_SERVICE_ROLE_KEY, serviceRoleValid, 'sb_secret_… or legacy eyJ… JWT'),
    FOOTBALL_DATA_API_KEY: check(e.FOOTBALL_DATA_API_KEY, (s) => s.length >= 16, 'football-data.org token'),
    CRON_SECRET: check(e.CRON_SECRET, (s) => s.length >= 16, 'shared with the cron worker'),
  }

  // Needed only by specific features; missing = that feature degrades, not a 500 everywhere.
  const optional = {
    RESEND_API_KEY: check(e.RESEND_API_KEY, (s) => s.startsWith('re_'), 'notify-picks-reminder only'),
    RESEND_FROM_EMAIL: check(e.RESEND_FROM_EMAIL, (s) => s.includes('@'), 'notify-picks-reminder only'),
    NEXT_PUBLIC_APP_URL: check(e.NEXT_PUBLIC_APP_URL, (s) => s.includes('/soccer-fantasy'), 'email links; must include the /soccer-fantasy basePath'),
  }

  const missingRequired = Object.entries(required).filter(([, c]) => !c.present || !c.looksValid).map(([k]) => k)
  const ok = missingRequired.length === 0

  return NextResponse.json(
    {
      ok,
      worker: 'soccer-fantasy (app)',
      checkedAt: new Date().toISOString(),
      missingRequired,
      required,
      optional,
    },
    { status: ok ? 200 : 503 },
  )
}

export { handler as GET, handler as POST }
