// Shared authorization for cron/admin-triggered API routes.
// A request is authorized if it carries the cron bearer secret (server-to-server
// cron worker) OR it is an authenticated admin session (manual trigger from /admin).
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from './supabase-server'
import { isAdminUser } from './admin'

export async function isCronOrAdmin(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user && isAdminUser(user.id)
  } catch {
    return false
  }
}
