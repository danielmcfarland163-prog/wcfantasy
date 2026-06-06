'use client'

import { useState } from 'react'
import PillTabs from '@/components/ui/PillTabs'
import { GROUP_KEYS, GROUPS } from '@/lib/bracket'

interface Score {
  user_id: string
  total_points: number
  picks_points: number | null
  bracket_points: number | null
  picks_correct: number | null
  bracket_correct: number | null
  correct_results: number
  picks_made: number
  global_rank: number | null
  profile: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null
}

interface Props {
  scores: Score[]
  userId: string
}

const MODES = ['Combined', 'Picks', 'Brackets'] as const
type Mode = typeof MODES[number]

function sorted(scores: Score[], mode: Mode): Score[] {
  return [...scores].sort((a, b) => {
    if (mode === 'Picks')    return (b.picks_points ?? 0) - (a.picks_points ?? 0)
    if (mode === 'Brackets') return (b.bracket_points ?? 0) - (a.bracket_points ?? 0)
    return (b.total_points ?? 0) - (a.total_points ?? 0)
  })
}

function pts(s: Score, mode: Mode): number {
  if (mode === 'Picks')    return s.picks_points ?? 0
  if (mode === 'Brackets') return s.bracket_points ?? 0
  return s.total_points ?? 0
}

function detail(s: Score, mode: Mode): string {
  if (mode === 'Picks')    return `${s.picks_correct ?? 0} correct predictions`
  if (mode === 'Brackets') return `${s.bracket_correct ?? 0} correct bracket picks`
  return `${s.picks_points ?? 0} picks + ${s.bracket_points ?? 0} bracket`
}

export default function StatsClient({ scores, userId }: Props) {
  const [mode, setMode] = useState<Mode>('Combined')
  const [tab, setTab]   = useState('Standings')

  const rows   = sorted(scores, mode)
  const myIdx  = rows.findIndex(s => s.user_id === userId)
  const me     = myIdx >= 0 ? rows[myIdx] : null

  return (
    <div style={{ paddingBottom: 28 }}>
      <div style={{ padding: '8px 20px 14px' }}>
        <div className="wc-eyebrow">TOURNAMENT LEADERS</div>
        <h1 className="wc-title">Stats</h1>
      </div>

      <PillTabs tabs={['Standings', 'Groups']} active={tab} onChange={setTab} />

      {tab === 'Standings' && (
        <div style={{ padding: '0 20px', marginTop: 18 }}>

          {/* Mode switcher */}
          <div style={{ display:'flex', gap:4, padding:3, borderRadius:11, background:'var(--surface-2)', marginBottom:20 }}>
            {MODES.map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex:1, border:'none', cursor:'pointer', padding:'7px 4px', borderRadius:8,
                background: mode === m ? 'var(--surface)' : 'transparent',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                fontFamily:'var(--f-body)', fontWeight: mode === m ? 700 : 500, fontSize:13,
                color: mode === m ? 'var(--ink)' : 'var(--ink-3)', transition:'all .15s',
              }}>{m}</button>
            ))}
          </div>

          {/* My rank card */}
          {me && (
            <div style={{
              display:'flex', alignItems:'center', gap:12, padding:'16px 18px',
              borderRadius:20, marginBottom:16, color:'#fff',
              background:'linear-gradient(135deg, var(--navy), color-mix(in srgb, var(--navy) 65%, var(--accent)))',
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--f-mono)', fontSize:10, letterSpacing:1, opacity:0.7 }}>YOUR RANK · {mode.toUpperCase()}</div>
                <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:34, lineHeight:1 }}>#{myIdx + 1}</div>
                <div style={{ fontFamily:'var(--f-body)', fontSize:11.5, opacity:0.75 }}>of {rows.length} players</div>
              </div>
              <div style={{ width:1, height:48, background:'rgba(255,255,255,0.18)' }} />
              <div style={{ textAlign:'center', paddingLeft:4 }}>
                <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:28 }}>{pts(me, mode)}</div>
                <div style={{ fontFamily:'var(--f-mono)', fontSize:9, letterSpacing:0.5, opacity:0.7 }}>POINTS</div>
              </div>
            </div>
          )}

          {/* Leaderboard table */}
          {rows.length === 0 ? (
            <div style={{ padding:'40px 24px', textAlign:'center', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16 }}>
              <div style={{ fontFamily:'var(--f-cond)', fontWeight:700, fontSize:18, color:'var(--ink-2)' }}>No scores yet</div>
              <div style={{ fontFamily:'var(--f-body)', fontSize:13, color:'var(--ink-3)', marginTop:4 }}>Scores appear after picks are scored</div>
            </div>
          ) : (
            <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
              {rows.map((s, i) => {
                const isMe = s.user_id === userId
                const medals = ['🥇','🥈','🥉']
                const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
                const name = p?.display_name ?? p?.username ?? 'Unknown'
                return (
                  <div key={s.user_id} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'11px 14px',
                    borderTop: i ? '1px solid var(--line)' : 'none',
                    background: isMe ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'var(--surface)',
                  }}>
                    <span style={{ width:28, textAlign:'center', fontSize:16, flexShrink:0 }}>
                      {i < 3 ? medals[i] : <span style={{ fontFamily:'var(--f-mono)', fontSize:12, color:'var(--ink-3)' }}>{i+1}</span>}
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:14, color:'var(--ink)', display:'flex', alignItems:'center', gap:6 }}>
                        {name}
                        {isMe && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--accent)', fontWeight:700 }}>YOU</span>}
                      </div>
                      <div style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--ink-3)', marginTop:1 }}>{detail(s, mode)}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:20, color:'var(--ink)' }}>{pts(s, mode)}</div>
                      <div style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--ink-3)' }}>pts</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'Groups' && (
        <div style={{ padding:'0 20px', marginTop:18 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }} className="grp-grid">
            {GROUP_KEYS.map(gk => {
              const grp = GROUPS[gk]
              return (
                <div key={gk} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden' }}>
                  <div style={{ padding:'8px 12px', background:'var(--surface-2)', borderBottom:'1px solid var(--line)', fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--ink-3)', letterSpacing:'0.8px' }}>
                    GROUP {gk}
                  </div>
                  {grp.teams.map((t, i) => (
                    <div key={t.n} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontSize:18 }}>{t.f}</span>
                      <span style={{ fontFamily:'var(--f-body)', fontWeight:500, fontSize:13, color:'var(--ink)', flex:1 }}>{t.n}</span>
                      <span style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--ink-3)' }}>{t.c}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <style>{`@media(min-width:700px){.grp-grid{grid-template-columns:repeat(3,1fr)!important}}@media(min-width:960px){.grp-grid{grid-template-columns:repeat(4,1fr)!important}}`}</style>
        </div>
      )}
    </div>
  )
}
