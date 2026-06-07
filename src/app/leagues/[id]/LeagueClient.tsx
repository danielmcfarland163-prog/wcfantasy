'use client'

import { useState } from 'react'
import Link from 'next/link'
import LeagueChat from '@/components/LeagueChat'
import CopyInviteButton from '@/components/CopyInviteButton'
import BracketReviewer from '@/components/BracketReviewer'
import RealtimeRefresh from '@/components/RealtimeRefresh'

type GameMode = 'picks' | 'bracket' | 'both' | 'combined'
type StandingsTab = 'picks' | 'bracket' | 'combined'

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

interface Score {
  user_id: string
  total_points: number
  picks_points?: number
  bracket_points?: number
  picks_rank?: number
  bracket_rank?: number
  picks_rank_change?: number
  bracket_rank_change?: number
  rank_change?: number
  picks_made?: number
  profile?: { username: string; display_name?: string }
}

interface TournamentResults {
  group_results: Record<string, { first: string; second: string; third: string }>
  third_quals: string[]
  r32_results: (string | null)[]
  r16_results: (string | null)[]
  qf_results:  (string | null)[]
  sf_results:  (string | null)[]
  final_result: string | null
}

interface LeagueClientProps {
  league: { id: string; name: string; description?: string; invite_code: string; game_mode?: GameMode; commissioner_id: string }
  scores: Score[]
  bracketEntries: any[]
  currentUserId: string
  currentProfile: { username: string; display_name?: string } | null
  inviteUrl: string
  tournamentResults?: TournamentResults | null
}

export default function LeagueClient({ league, scores, bracketEntries, currentUserId, currentProfile, inviteUrl, tournamentResults }: LeagueClientProps) {
  const mode: GameMode = league.game_mode ?? 'both'
  const modeMeta = MODE_META[mode]

  const defaultTab: StandingsTab = mode === 'bracket' ? 'bracket' : mode === 'combined' ? 'combined' : 'picks'
  const [activeTab, setActiveTab] = useState<StandingsTab>(defaultTab)

  function getPoints(s: Score): number {
    if (activeTab === 'bracket') return s.bracket_points ?? 0
    if (activeTab === 'combined') return (s.picks_points ?? 0) + (s.bracket_points ?? 0)
    return s.picks_points ?? s.total_points ?? 0
  }

  function getRankChange(s: Score): number {
    if (activeTab === 'bracket') return s.bracket_rank_change ?? 0
    return s.picks_rank_change ?? s.rank_change ?? 0
  }

  const sorted = [...scores].sort((a, b) => getPoints(b) - getPoints(a))
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  const showTabs = mode === 'both'

  return (
    <div style={{ paddingBottom: 40, background: 'var(--bg)', minHeight: '100svh' }}>
      <RealtimeRefresh tables={['league_scores']} filter={`league_id=eq.${league.id}`} />

      {/* ── HERO ─────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(145deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 55%, #0a0d1a) 100%)',
        padding: '16px 20px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <Link href="/leagues" style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.5, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
          ← Leagues
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', marginBottom: 10 }}>
              <span style={{ fontSize: 12 }}>{modeMeta.icon}</span>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '1px', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' }}>{modeMeta.label}</span>
            </div>
            <h1 style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 28, color: '#fff', lineHeight: 1.1, margin: 0, wordBreak: 'break-word' }}>{league.name}</h1>
            {league.description && (
              <p style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, marginBottom: 0 }}>{league.description}</p>
            )}
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
              {scores.length} member{scores.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Invite code strip */}
        <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(8px)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, letterSpacing: '1px', color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>INVITE CODE</div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 4 }}>{league.invite_code}</div>
          </div>
          <CopyInviteButton inviteUrl={inviteUrl} />
        </div>
      </div>

      {/* ── STANDINGS ────────────────────────────────── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Standings</div>

          {showTabs && (
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, border: '1px solid var(--line)' }}>
              {(['picks', 'bracket'] as StandingsTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', transition: 'all .15s', background: activeTab === tab ? 'var(--surface)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--ink-3)', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                  {tab === 'picks' ? '⚽ Picks' : '🗂 Bracket'}
                </button>
              ))}
            </div>
          )}
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 18 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏁</div>
            <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>No scores yet</div>
            <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Scores appear once matches are played</div>
          </div>
        ) : (
          <>
            {/* ── PODIUM (top 3) ─────────────────────── */}
            {top3.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, padding: '8px 0 0' }}>
                  {/* Reorder: 2nd, 1st, 3rd */}
                  {[top3[1], top3[0], top3[2]].map((s, podiumIdx) => {
                    if (!s) return <div key={podiumIdx} style={{ flex: 1 }} />
                    const rank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3
                    const heights = [72, 100, 56]
                    const podiumHeight = heights[podiumIdx]
                    const isMe = s.user_id === currentUserId
                    const displayName = s.profile?.display_name ?? s.profile?.username ?? 'Player'
                    const pts = getPoints(s)
                    const rankColors = ['#c0a060', '#d4af37', '#a0755a']
                    const rankColor = rankColors[podiumIdx]
                    return (
                      <div key={s.user_id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        {rank === 1 && <span style={{ fontSize: 20 }}>🏆</span>}
                        <Avatar name={displayName} size={rank === 1 ? 48 : 38} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 12, color: isMe ? 'var(--accent)' : 'var(--ink)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayName}{isMe && ' 👤'}
                          </div>
                          <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>{pts}</div>
                        </div>
                        <div style={{ width: '100%', height: podiumHeight, background: `color-mix(in srgb, ${rankColor} 20%, var(--surface))`, border: `1.5px solid color-mix(in srgb, ${rankColor} 40%, var(--line))`, borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10 }}>
                          <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 22, color: rankColor }}>{rank}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ height: 3, background: 'var(--line)', borderRadius: 2, marginTop: 0 }} />
              </div>
            )}

            {/* ── REST OF STANDINGS ──────────────────── */}
            {rest.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                {rest.map((s, i) => {
                  const rank = i + 4
                  const isMe = s.user_id === currentUserId
                  const displayName = s.profile?.display_name ?? s.profile?.username ?? 'Player'
                  const pts = getPoints(s)
                  const change = getRankChange(s)
                  return (
                    <div key={s.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', background: isMe ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)' }}>
                      <span style={{ width: 22, fontFamily: 'var(--f-mono)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', flexShrink: 0 }}>{rank}</span>
                      <Avatar name={displayName} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
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
                      <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 20, color: 'var(--ink)' }}>{pts}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CHAT ─────────────────────────────────────── */}
      <div style={{ padding: '28px 20px 0' }}>
        <div className="wc-section-head" style={{ margin: '0 0 10px' }}>Chat</div>
        <LeagueChat leagueId={league.id} userId={currentUserId} username={currentProfile?.username ?? 'you'} />
      </div>

      {/* ── BRACKET REVIEWS ──────────────────────────── */}
      {(mode === 'bracket' || mode === 'both' || mode === 'combined') && bracketEntries.length > 0 && (
        <div style={{ padding: '28px 20px 0' }}>
          <div className="wc-section-head" style={{ margin: '0 0 10px' }}>Bracket Reviews</div>
          <BracketReviewer entries={bracketEntries} currentUserId={currentUserId} tournamentResults={tournamentResults} />
        </div>
      )}
    </div>
  )
}
