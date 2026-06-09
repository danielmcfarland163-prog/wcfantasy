import type { CSSProperties } from 'react'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Flag, { isoForTeam } from '@/components/ui/Flag'
import { BracketDetail } from '@/components/BracketReviewer'
import SummaryTabs from './SummaryTabs'
import { isGroupLocked, isKnockoutLocked, GROUP_LOCK, KNOCKOUT_LOCK, BRACKET_RESET_ENABLED } from '@/lib/bracket'
import { MATCH_PICKS_ENABLED } from '@/lib/features'
import { formatKickoff } from '@/lib/utils'

const STAGE_LABELS: Record<string, string> = {
  GROUP: 'Group', R32: 'Round of 32', R16: 'Round of 16',
  QF: 'Quarterfinal', SF: 'Semifinal', THIRD: 'Third Place', FINAL: 'Final',
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['#2f6fe0', '#1f9d5a', '#e03c2c', '#c98a1a', '#7c3aed', '#0891b2', '#db2777', '#059669']
function avatarColor(str: string) {
  let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// Result → chip styling (matches the scoring model: EXACT 5×, CORRECT 3×, else 0)
function resultChip(result: string | null, pts: number | null) {
  if (result === 'EXACT')   return { label: `Exact +${pts ?? 5}`,   fg: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 14%, transparent)' }
  if (result === 'CORRECT') return { label: `Correct +${pts ?? 3}`, fg: 'var(--win)',  bg: 'color-mix(in srgb, var(--win) 12%, transparent)' }
  if (result === 'WRONG')   return { label: 'Missed',               fg: 'var(--live)', bg: 'color-mix(in srgb, var(--live) 10%, transparent)' }
  return { label: 'Pending', fg: 'var(--ink-3)', bg: 'var(--surface-2)' }
}

export default async function MemberPicksPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Both the viewer and the target must belong to this league.
  const { data: viewerMembership } = await supabase
    .from('league_members').select('user_id').eq('league_id', id).eq('user_id', user.id).single()
  if (!viewerMembership) notFound()

  const { data: targetMembership } = await supabase
    .from('league_members').select('user_id').eq('league_id', id).eq('user_id', userId).single()
  if (!targetMembership) notFound()

  const { data: league } = await supabase.from('leagues').select('id, name').eq('id', id).single()
  if (!league) notFound()

  const { data: profile } = await supabase
    .from('profiles').select('username, display_name').eq('id', userId).single()

  const { data: score } = await supabase
    .from('league_scores')
    .select('picks_points, total_points, bracket_points, correct_results, exact_scores, picks_made, picks_rank, rank')
    .eq('league_id', id).eq('user_id', userId).single()

  // Picks RLS reveals another member's pick once its match is LIVE/FINISHED (or
  // kicked off), so upcoming picks stay hidden. (Your own row returns everything.)
  const { data: picksRaw } = await supabase
    .from('picks')
    .select('id, home_score_pick, away_score_pick, points_earned, pick_result, match:matches(id, kickoff_time, stage, group_letter, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, short_code), away_team:teams!matches_away_team_id_fkey(name, short_code))')
    .eq('user_id', userId)

  const picks = (picksRaw ?? [])
    .filter((p: any) => p.match)
    .sort((a: any, b: any) => new Date(a.match.kickoff_time).getTime() - new Date(b.match.kickoff_time).getTime())

  // Bracket: bracket_entries RLS keeps other members' brackets private until the
  // tournament locks, so this is null for other players pre-lock (by design).
  const { data: tournamentResults } = await supabase
    .from('tournament_results').select('*').eq('id', 1).maybeSingle()

  const isSelf = userId === user.id
  const viewerIsAdmin = isAdminUser(user.id)
  const canSeeAny = isSelf || viewerIsAdmin
  // Each mode reveals to other members at its own final lock: pickem at the group
  // lock, reset at the knockout lock.
  const pickemVisible = canSeeAny || isGroupLocked()
  const resetVisible = canSeeAny || isKnockoutLocked()

  // Target's brackets — now up to two rows (pickem + reset). RLS hides other
  // members' rows until the group lock; admins bypass with the service-role client.
  let bracketRows: any[] = (await supabase
    .from('bracket_entries')
    .select('*, profile:profiles(username, display_name)')
    .eq('user_id', userId)).data ?? []
  let adminBracketBypass = false
  if (bracketRows.length === 0 && viewerIsAdmin && !isSelf) {
    try {
      const admin = createAdminSupabaseClient()
      const res = await admin
        .from('bracket_entries')
        .select('*, profile:profiles(username, display_name)')
        .eq('user_id', userId)
      if (res.data?.length) { bracketRows = res.data; adminBracketBypass = true }
    } catch { /* service key unavailable — fall back to the locked state */ }
  }
  const pickemEntry = bracketRows.find((r: any) => r.mode === 'pickem') ?? null
  const resetEntry = bracketRows.find((r: any) => r.mode === 'reset') ?? null
  const groupLockLabel = GROUP_LOCK.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const knockoutLockLabel = KNOCKOUT_LOCK.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const name = profile?.display_name ?? profile?.username ?? 'Player'
  const rank = score?.rank ?? score?.picks_rank ?? null

  const stat = (label: string, value: string | number) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 20, color: '#fff', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 8.5, letterSpacing: 0.5, opacity: 0.7, marginTop: 3 }}>{label}</div>
    </div>
  )

  const numHead: CSSProperties = { width: 30, flexShrink: 0, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3, color: 'var(--ink-3)' }
  const numCell: CSSProperties = { width: 30, flexShrink: 0, textAlign: 'center', fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18, lineHeight: 1 }

  // ── Picks panel ──────────────────────────────────────────────────────────────
  const picksContent = picks.length === 0 ? (
    <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 18 }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
      <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>No picks to show yet</div>
      <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
        {isSelf ? 'Make some predictions on the Picks tab.' : 'Picks stay hidden until each match kicks off.'}
      </div>
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }} className="member-picks-grid">
      {picks.map((p: any) => {
        const m = p.match
        const finished = m.status === 'FINISHED' && m.home_score != null && m.away_score != null
        const chip = resultChip(p.pick_result, p.points_earned)
        const home = m.home_team ?? { name: 'Home', short_code: '' }
        const away = m.away_team ?? { name: 'Away', short_code: '' }
        const teamLine = (t: { name: string; short_code: string }, pick: number, actual: number | null) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Flag iso={isoForTeam(t.short_code)} size={22} radius={5} ring={false} alt={t.name} />
            <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
            <span style={{ ...numCell, color: 'var(--accent)' }}>{pick}</span>
            <span style={{ ...numCell, color: finished ? 'var(--ink)' : 'var(--ink-3)' }}>{finished ? actual : '–'}</span>
          </div>
        )
        return (
          <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', boxShadow: '0 1px 2px rgba(20,22,40,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                {STAGE_LABELS[m.stage] ?? m.stage}{m.group_letter ? ` ${m.group_letter}` : ''} · {formatKickoff(m.kickoff_time)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, fontWeight: 700, color: chip.fg, background: chip.bg, borderRadius: 6, padding: '3px 8px' }}>
                  {chip.label}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ width: 22, flexShrink: 0 }} />
              <span style={{ flex: 1 }} />
              <span style={numHead}>PICK</span>
              <span style={numHead}>FT</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {teamLine(home, p.home_score_pick, m.home_score)}
              {teamLine(away, p.away_score_pick, m.away_score)}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── Bracket panel (two modes: Up-Front Pick'em + Bracket Reset) ─────────────
  const modePanel = (label: string, blurb: string, entry: any, visible: boolean, lockDateLabel: string) => {
    const body = !visible ? (
      <div style={{ padding: '28px 18px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 16 }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>🔒</div>
        <div style={{ fontFamily: 'var(--f-body)', fontSize: 12.5, color: 'var(--ink-3)' }}>Hidden until it locks on {lockDateLabel}.</div>
      </div>
    ) : entry ? (
      <BracketDetail entry={entry as any} results={(tournamentResults ?? null) as any} />
    ) : (
      <div style={{ padding: '28px 18px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 16 }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>🗂</div>
        <div style={{ fontFamily: 'var(--f-body)', fontSize: 12.5, color: 'var(--ink-3)' }}>
          {isSelf ? 'Not built yet — fill it on the Bracket tab.' : 'This player hasn’t filled out this bracket.'}
        </div>
      </div>
    )
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>{label}</span>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, color: 'var(--ink-3)' }}>{blurb}</span>
        </div>
        {body}
      </div>
    )
  }

  const bracketContent = (
    <>
      {adminBracketBypass && (
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--line))', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
          🛡 ADMIN VIEW · brackets are normally hidden from other members until they lock
        </div>
      )}
      {modePanel(BRACKET_RESET_ENABLED ? 'Up-Front Pick’em' : 'Bracket', `locks ${groupLockLabel}`, pickemEntry, pickemVisible, groupLockLabel)}
      {BRACKET_RESET_ENABLED && modePanel('Bracket Reset', `locks ${knockoutLockLabel}`, resetEntry, resetVisible, knockoutLockLabel)}
    </>
  )

  return (
    <AppShell>
      <div style={{ paddingBottom: 32 }}>
        {/* Header */}
        <div style={{ padding: '8px 20px 14px' }}>
          <Link href={`/leagues/${id}`} style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.5, color: 'var(--ink-3)', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
            ← {league.name}
          </Link>

          {/* Player card */}
          <div style={{
            borderRadius: 20, padding: '18px', color: '#fff',
            background: 'linear-gradient(135deg, var(--navy), color-mix(in srgb, var(--navy) 65%, var(--accent)))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 21, color: '#fff' }}>{initials(name)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, letterSpacing: 1, opacity: 0.7 }}>
                  {isSelf ? 'YOUR SUMMARY' : 'PLAYER SUMMARY'}
                </div>
                <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 26, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                {profile?.username && <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, opacity: 0.6 }}>@{profile.username}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              {stat('RANK', rank ? `#${rank}` : '—')}
              {stat('TOTAL', (MATCH_PICKS_ENABLED ? score?.total_points : score?.bracket_points) ?? 0)}
              {MATCH_PICKS_ENABLED && stat('PICKS', score?.picks_points ?? 0)}
              {MATCH_PICKS_ENABLED && stat('BRACKET', score?.bracket_points ?? 0)}
            </div>
          </div>
        </div>

        {/* Tabbed summary: Match Picks / Bracket */}
        <div style={{ padding: '6px 20px 0' }}>
          <SummaryTabs picks={picksContent} bracket={bracketContent} />
        </div>

        <style>{`
          @media (min-width:600px)  { .member-picks-grid { grid-template-columns:repeat(2,1fr) !important; } }
          @media (min-width:1100px) { .member-picks-grid { grid-template-columns:repeat(3,1fr) !important; } }
        `}</style>
      </div>
    </AppShell>
  )
}
