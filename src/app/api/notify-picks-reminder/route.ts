// Cron: runs daily at 6pm
// Sends email reminders to users who have unpicked matches within 24 hours

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'
import { Resend } from 'resend'
import { formatKickoff } from '@/lib/utils'
import { addHours } from 'date-fns'

async function handler(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const FROM = process.env.RESEND_FROM_EMAIL!
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

  const supabase = createAdminSupabaseClient()
  const now = new Date()
  const in24h = addHours(now, 24)

  // Matches kicking off in next 24 hours
  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('id, kickoff_time, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)')
    .eq('status', 'SCHEDULED')
    .gte('kickoff_time', now.toISOString())
    .lte('kickoff_time', in24h.toISOString())

  if (!upcomingMatches?.length) {
    return NextResponse.json({ message: 'No upcoming matches to notify', sent: 0 })
  }

  const matchIds = upcomingMatches.map(m => m.id)

  // Find users who haven't picked for these matches
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, display_name')

  const { data: existingPicks } = await supabase
    .from('picks')
    .select('user_id, match_id')
    .in('match_id', matchIds)

  const pickSet = new Set((existingPicks ?? []).map(p => `${p.user_id}:${p.match_id}`))

  // Per user, which matches are they missing?
  const usersToNotify: Array<{ id: string; display_name: string; missingCount: number }> = []
  for (const user of (allUsers ?? [])) {
    const missing = matchIds.filter(mid => !pickSet.has(`${user.id}:${mid}`))
    if (missing.length > 0) {
      usersToNotify.push({ id: user.id, display_name: user.display_name, missingCount: missing.length })
    }
  }

  // Get emails from auth
  let sent = 0
  for (const u of usersToNotify) {
    const { data: authUser } = await supabase.auth.admin.getUserById(u.id)
    const email = authUser?.user?.email
    if (!email) continue

    const matchList = upcomingMatches
      .map((m: any) => `• ${m.home_team?.name} vs ${m.away_team?.name} — ${formatKickoff(m.kickoff_time)}`)
      .join('\n')

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `⚽ ${u.missingCount} match${u.missingCount > 1 ? 'es' : ''} locking soon — make your picks!`,
      text: `Hi ${u.display_name},\n\nThese matches are locking in the next 24 hours and you haven't picked yet:\n\n${matchList}\n\nMake your picks now: ${APP_URL}/picks\n\n— WC Fantasy 2026`,
      html: `
        <p>Hi ${u.display_name},</p>
        <p>These matches are locking in the next 24 hours and you haven't picked yet:</p>
        <ul>${upcomingMatches.map((m: any) => `<li><strong>${(m as any).home_team?.name} vs ${(m as any).away_team?.name}</strong> — ${formatKickoff(m.kickoff_time)}</li>`).join('')}</ul>
        <p><a href="${APP_URL}/picks" style="background:#16a34a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Make your picks →</a></p>
        <p style="color:#9ca3af;font-size:12px;">You're receiving this because you're playing WC Fantasy 2026.</p>
      `,
    })
    sent++
  }

  return NextResponse.json({ message: 'Reminders sent', sent, total: usersToNotify.length })
}

export { handler as GET, handler as POST }
