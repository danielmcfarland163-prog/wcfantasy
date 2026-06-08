'use client'

import { useEffect, type CSSProperties } from 'react'
import Link from 'next/link'
import LeagueChat from '@/components/LeagueChat'
import CopyInviteButton from '@/components/CopyInviteButton'
import RealtimeRefresh from '@/components/RealtimeRefresh'

type GameMode = 'picks' | 'bracket' | 'both' | 'combined'

const MODE_META: Record<GameMode, { icon: string; label: string }> = {
  picks:    { icon: '⚽', label: 'Match Picks' },
  bracket:  { icon: '🗂',  label: 'Bracket' },
  both:     { icon: '✦',  label: 'Both Modes' },
  combined: { icon: '⚡', label: 'Combined' },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['#2f6fe0','#1f9d5a','#e03c2c','#c98a1a','#7c3aed','#0891b2','#db2777','#059669']
function avatarColor(str: string) {
  let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const color = avatarColor(name)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: size * 0.38, color: '#fff', lineHeight: 1 }}>{initials(name)}</span>
    </div>
  )
}

const headCell: CSSProperties = { flexShrink: 0, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.3px' }
const numCell:  CSSProperties = { flexShrink: 0, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--ink-2)' }

interface Score {
  user_id: string
  total_points: number
  picks_points?: number
  bracket_points?: number
  rank_change?: number
  profile?: { username: string; display_name?: string }
}

interface LeagueClientProps {
  league: { id: string; name: string; description?: string; invite_code: string; game_mode?: GameMode; commissioner_id: string }
  scores: Score[]
  currentUserId: string
  currentProfile: { username: string; display_name?: string } | null
  inviteUrl: string
}

export default function LeagueClient({ league, scores, currentUserId, currentProfile, inviteUrl }: LeagueClientProps) {
  const mode: GameMode = league.game_mode ?? 'both'
  const modeMeta = MODE_META[mode]

  // Open at the top: AppShell scrolls an inner container (.wc-noscroll), not the
  // window, so default scroll restoration can leave the page mid-scroll.
  useEffect(() => {
    const reset = () => {
      const el = document.querySelector('.wc-noscroll') as HTMLElement | null
      if (el) el.scrollTop = 0
      else window.scrollTo(0, 0)
    }
    reset()
    requestAnimationFrame(reset)
  }, [])

  const picksOf   = (s: Score) => s.picks_points ?? 0
  const bracketOf = (s: Score) => s.bracket_points ?? 0
  const totalOf   = (s: Score) => picksOf(s) + bracketOf(s)

  const sorted = [...scores].sort((a, b) => totalOf(b) - totalOf(a) || picksOf(b) - picksOf(a))
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{ paddingBottom: 40, background: 'var(--bg)', minHeight: '100svh' }}>
      <RealtimeRefresh tables={['league_scores']} filter={`league_id=eq.${league.id}`} />

      {/* ── HERO (compact) ───────────────────────────── */}
      <div style={{
        background: 'linear-gradient(145deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 55%, #0a0d1a) 100%)',
        padding: '12px 20px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <Link href="/leagues" style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.5, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
          ← Leagues
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.15)' }}>
            <span style={{ fontSize: 11 }}>{modeMeta.icon}</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '1px', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' }}>{modeMeta.label}</span>
          </div>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            {scores.length} member{scores.length !== 1 ? 's' : ''}
          </span>
        </div>

        <h1 style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 20, color: '#fff', lineHeight: 1.15, margin: '8px 0 0', wordBreak: 'break-word' }}>{league.name}</h1>
        {league.description && (
          <p style={{ fontFamily: 'var(--f-body)', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3, marginBottom: 0 }}>{league.description}</p>
        )}

        {/* Invite code strip */}
        <div style={{ marginTop: 14, padding: '9px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(8px)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 8.5, letterSpacing: '1px', color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>INVITE CODE</div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: 3 }}>{league.invite_code}</div>
          </div>
          <CopyInviteButton inviteUrl={inviteUrl} />
        </div>
      </div>

      {/* ── STANDINGS ────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 12 }}>Standings</div>

        {sorted.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 18 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏁</div>
            <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>No scores yet</div>
            <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Scores appear once matches are played</div>
          </div>
        ) : (
          <>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflowX: 'auto' }}>
              <div style={{ minWidth: 300 }}>
                {/* Column headers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ ...headCell, width: 22 }}>#</span>
                  <span style={{ flex: 1, minWidth: 92, fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.3px' }}>PLAYER</span>
                  <span style={{ ...headCell, width: 42 }} title="Match picks points">PICKS</span>
                  <span style={{ ...headCell, width: 48 }} title="Bracket points">BRACKET</span>
                  <span style={{ ...headCell, width: 50, color: 'var(--ink-2)' }} title="Combined total">TOTAL</span>
                  <span style={{ width: 14, flexShrink: 0 }} aria-hidden />
                </div>

                {/* Member rows */}
                {sorted.map((s, i) => {
                  const rank = i + 1
                  const isMe = s.user_id === currentUserId
                  const displayName = s.profile?.display_name ?? s.profile?.username ?? 'Player'
                  const change = s.rank_change ?? 0
                  return (
                    <Link key={s.user_id} href={`/leagues/${league.id}/picks/${s.user_id}`} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                      borderTop: i ? '1px solid var(--line)' : 'none',
                      background: isMe ? 'color-mix(in srgb, var(--accent) 7%, var(--surface))' : 'var(--surface)',
                      textDecoration: 'none', color: 'inherit', cursor: 'pointer',
                    }}>
                      <span style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>
                        {rank <= 3
                          ? <span style={{ fontSize: 14 }}>{medals[rank - 1]}</span>
                          : <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)' }}>{rank}</span>}
                      </span>
                      <div style={{ flex: 1, minWidth: 92, display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar name={displayName} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--f-body)', fontWeight: isMe ? 700 : 600, fontSize: 14, color: isMe ? 'var(--accent)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayName}
                            {isMe && <span style={{ fontFamily: 'var(--f-mono)', fontSize: 8, color: 'var(--accent)', marginLeft: 6 }}>YOU</span>}
                          </div>
                          {change !== 0 && (
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: change > 0 ? 'var(--win)' : 'var(--live)', marginTop: 1 }}>
                              {change > 0 ? `▲ ${change}` : `▼ ${Math.abs(change)}`}
                            </div>
                          )}
                        </div>
                      </div>
                      <span style={{ ...numCell, width: 42 }}>{picksOf(s)}</span>
                      <span style={{ ...numCell, width: 48 }}>{bracketOf(s)}</span>
                      <span style={{ ...numCell, width: 50, fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>{totalOf(s)}</span>
                      <span style={{ width: 14, flexShrink: 0, textAlign: 'center', color: 'var(--ink-3)', fontSize: 15, lineHeight: 1 }}>›</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
              TOTAL = picks + bracket. Tap a player to see their full picks &amp; bracket.
            </div>
          </>
        )}
      </div>

      {/* ── CHAT ─────────────────────────────────────── */}
      <div style={{ padding: '28px 20px 0' }}>
        <div className="wc-section-head" style={{ margin: '0 0 10px' }}>Chat</div>
        <LeagueChat leagueId={league.id} userId={currentUserId} username={currentProfile?.username ?? 'you'} />
      </div>
    </div>
  )
}
