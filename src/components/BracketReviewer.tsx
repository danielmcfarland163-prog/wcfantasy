'use client'
import { useState } from 'react'
import { dbToState, GROUP_KEYS, teamByName } from '@/lib/bracket'
import { scoreBracketEntry, BRACKET_PTS } from '@/lib/bracket-scoring'
import type { BracketEntry } from '@/lib/types'

interface TournamentResults {
  group_results: Record<string, { first: string; second: string; third: string }>
  third_quals: string[]
  r32_results: (string | null)[]
  r16_results: (string | null)[]
  qf_results:  (string | null)[]
  sf_results:  (string | null)[]
  final_result: string | null
}

interface Props {
  entries: BracketEntry[]
  currentUserId: string
  tournamentResults?: TournamentResults | null
}

const GC: Record<string, string> = {
  A:'#2f6fe0',B:'#1f9d5a',C:'#e03c2c',D:'#c98a1a',
  E:'#7c3aed',F:'#0891b2',G:'#db2777',H:'#059669',
  I:'#d97706',J:'#4f46e5',K:'#dc2626',L:'#0d9488',
}

export default function BracketReviewer({ entries, currentUserId, tournamentResults }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:'32px 24px', textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:10 }}>🗂</div>
        <p style={{ fontFamily:'var(--f-body)', fontSize:13, color:'var(--ink-3)' }}>No brackets submitted yet.</p>
      </div>
    )
  }

  const activeEntry = entries.find(e => e.user_id === selected) ?? null

  return (
    <div>
      {/* Member selector */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
        {entries.map(entry => {
          const name = entry.profile?.display_name ?? entry.profile?.username ?? '?'
          const isMe = entry.user_id === currentUserId
          const isActive = entry.user_id === selected
          const state = dbToState(entry as any)
          const hasChampion = !!state.final

          // Score summary via the shared engine (identical to the server)
          const sc = tournamentResults ? scoreBracketEntry(entry as any, tournamentResults as any) : null

          return (
            <button
              key={entry.user_id}
              onClick={() => setSelected(isActive ? null : entry.user_id)}
              style={{
                display:'flex', alignItems:'center', gap:7,
                padding:'7px 14px', borderRadius:24, cursor:'pointer',
                background: isActive ? 'var(--accent)' : 'var(--surface)',
                boxShadow: isActive ? '0 2px 8px -3px rgba(47,111,224,0.4)' : '0 1px 3px rgba(0,0,0,0.06)',
                border: isActive ? '1.5px solid transparent' : '1px solid var(--line)',
                transition:'all .15s',
              }}
            >
              <span style={{ width:26, height:26, borderRadius:'50%', background: isActive ? 'rgba(255,255,255,0.25)' : 'color-mix(in srgb,var(--accent) 15%,transparent)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--f-cond)', fontWeight:800, fontSize:11, color: isActive ? '#fff' : 'var(--accent)', flexShrink:0 }}>
                {name[0].toUpperCase()}
              </span>
              <span style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, color: isActive ? '#fff' : 'var(--ink)' }}>
                {name}
              </span>
              {isMe && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, opacity:0.7, color: isActive ? '#fff' : 'var(--ink-3)' }}>you</span>}
              {hasChampion && <span style={{ fontSize:12 }}>🏆</span>}
              {sc && (
                <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--surface-2)', color: isActive ? '#fff' : 'var(--win)' }}>
                  {sc.points} pts
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Bracket detail */}
      {activeEntry && <BracketDetail entry={activeEntry} results={tournamentResults} />}
    </div>
  )
}

function ResultBadge({ pick, actual }: { pick: string | null | undefined; actual: string | null | undefined }) {
  if (!actual || !pick) return null
  const correct = pick === actual
  return (
    <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:800, color: correct ? 'var(--win)' : 'var(--live)', flexShrink:0 }}>
      {correct ? '✓' : '✗'}
    </span>
  )
}

function BracketDetail({ entry, results }: { entry: BracketEntry; results?: TournamentResults | null }) {
  const state = dbToState(entry as any)
  const name = entry.profile?.display_name ?? entry.profile?.username ?? 'Unknown'
  const bracketPicks = [...state.r32, ...state.r16, ...state.qf, ...state.sf, state.final].filter(Boolean).length
  const hasResults = !!results

  const groupCorrect = hasResults ? GROUP_KEYS.reduce((acc, gk) => {
    if (state.gp[gk]?.first  === results!.group_results[gk]?.first)  acc++
    if (state.gp[gk]?.second === results!.group_results[gk]?.second) acc++
    return acc
  }, 0) : 0
  const thirdCorrect = hasResults ? state.tq.filter(nm => results!.third_quals.includes(nm)).length : 0
  const r32Correct   = hasResults ? state.r32.filter((p,i) => p && p === results!.r32_results[i]).length : 0
  const r16Correct   = hasResults ? state.r16.filter((p,i) => p && p === results!.r16_results[i]).length : 0
  const qfCorrect    = hasResults ? state.qf.filter((p,i)  => p && p === results!.qf_results[i]).length  : 0
  const sfCorrect    = hasResults ? state.sf.filter((p,i)  => p && p === results!.sf_results[i]).length  : 0

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:20, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', background:'var(--surface-2)', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:17, color:'var(--ink)' }}>{name}&apos;s Bracket</span>
        <span style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--ink-3)' }}>{bracketPicks}/31 picks</span>
      </div>

      <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:18 }}>

        {/* Champion */}
        {state.final ? (() => {
          const isCorrect = hasResults && results!.final_result ? state.final === results!.final_result : null
          return (
            <div style={{ padding:'20px 16px', borderRadius:16, textAlign:'center',
              background: isCorrect === true
                ? 'linear-gradient(135deg,color-mix(in srgb,var(--win) 18%,var(--surface)),color-mix(in srgb,var(--win) 6%,var(--surface)))'
                : 'linear-gradient(135deg,color-mix(in srgb,var(--gold) 14%,var(--surface)),color-mix(in srgb,var(--gold) 5%,var(--surface)))',
              border: `1.5px solid ${isCorrect === true ? 'color-mix(in srgb,var(--win) 40%,var(--line))' : 'color-mix(in srgb,var(--gold) 35%,var(--line))'}`,
            }}>
              <div style={{ fontSize:44, marginBottom:6 }}>{teamByName(state.final).f}</div>
              {isCorrect === true && <div style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:800, color:'var(--win)', letterSpacing:'1px', marginBottom:4 }}>🏆 CORRECT · +{BRACKET_PTS.champion} PTS</div>}
              {isCorrect === false && results!.final_result && (
                <div style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--live)', fontWeight:700, marginBottom:4 }}>
                  ✗ Winner was {teamByName(results!.final_result).f} {results!.final_result}
                </div>
              )}
              <div style={{ fontFamily:'var(--f-mono)', fontSize:9, letterSpacing:'2px', color: isCorrect === true ? 'var(--win)' : 'var(--gold)', fontWeight:700, marginBottom:3 }}>CHAMPION PICK</div>
              <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:24, color:'var(--ink)' }}>{state.final}</div>
            </div>
          )
        })() : (
          <div style={{ background:'var(--surface-2)', borderRadius:12, padding:'12px 16px', fontFamily:'var(--f-body)', fontSize:13, color:'var(--ink-3)' }}>No champion picked yet</div>
        )}

        {/* Group picks */}
        {Object.keys(state.gp).length > 0 && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--ink-3)', letterSpacing:'1px' }}>⚽ GROUP STAGE</span>
              {hasResults && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--win)' }}>{groupCorrect}/24</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)' }} className="rev-grid">
              {GROUP_KEYS.map((gk, i) => {
                const p = state.gp[gk]
                if (!p?.first && !p?.second) return null
                const t1 = p.first ? teamByName(p.first) : null
                const t2 = p.second ? teamByName(p.second) : null
                const actual = results?.group_results[gk]
                const color = GC[gk]
                return (
                  <div key={gk} style={{ padding:'8px 12px', borderTop:i>=2?'1px solid var(--line)':'none', borderLeft:i%2===1?'1px solid var(--line)':'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:5 }}>
                      <div style={{ width:14, height:14, borderRadius:4, background:color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:8, color:'#fff' }}>{gk}</span>
                      </div>
                    </div>
                    {t1 && (
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                        <span style={{ width:14, height:13, borderRadius:3, background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--f-mono)', fontSize:7, fontWeight:700, color:'#fff', flexShrink:0 }}>1</span>
                        <span style={{ fontSize:12 }}>{t1.f}</span>
                        <span style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:11, color:'var(--ink)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t1.n}</span>
                        <ResultBadge pick={p.first} actual={actual?.first} />
                      </div>
                    )}
                    {t2 && (
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:14, height:13, borderRadius:3, background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--f-mono)', fontSize:7, fontWeight:700, color:'var(--ink-3)', flexShrink:0 }}>2</span>
                        <span style={{ fontSize:12 }}>{t2.f}</span>
                        <span style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:11, color:'var(--ink)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t2.n}</span>
                        <ResultBadge pick={p.second} actual={actual?.second} />
                      </div>
                    )}
                  </div>
                )
              }).filter(Boolean)}
            </div>
          </div>
        )}

        {/* 3rd-place qualifiers */}
        {state.tq.length > 0 && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--ink-3)', letterSpacing:'1px' }}>🟢 3RD-PLACE QUALIFIERS</span>
              {hasResults && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--win)' }}>{thirdCorrect}/8</span>}
            </div>
            <div style={{ padding:'10px 14px', display:'flex', flexWrap:'wrap', gap:5 }}>
              {state.tq.map(nm => {
                const t = teamByName(nm)
                const correct = hasResults ? results!.third_quals.includes(nm) : null
                return (
                  <span key={nm} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:16,
                    background: correct === true ? 'color-mix(in srgb,var(--win) 10%,transparent)' : correct === false ? 'color-mix(in srgb,var(--live) 8%,transparent)' : 'color-mix(in srgb,var(--win) 8%,transparent)',
                    border: `1px solid ${correct === true ? 'color-mix(in srgb,var(--win) 28%,var(--line))' : correct === false ? 'color-mix(in srgb,var(--live) 22%,var(--line))' : 'color-mix(in srgb,var(--win) 20%,var(--line))'}`,
                    fontFamily:'var(--f-body)', fontSize:12, fontWeight:600, color:'var(--ink)' }}>
                    {t.f} {nm}
                    {correct !== null && <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:800, color: correct ? 'var(--win)' : 'var(--live)' }}>{correct ? '✓' : '✗'}</span>}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Knockout picks */}
        {bracketPicks > 0 && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--ink-3)', letterSpacing:'1px' }}>🏟️ KNOCKOUT PICKS</span>
              {hasResults && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--win)' }}>{r32Correct+r16Correct+qfCorrect+sfCorrect}/31</span>}
            </div>
            <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'R32', picks:state.r32, actuals:results?.r32_results, correct:r32Correct, total:16 },
                { label:'R16', picks:state.r16, actuals:results?.r16_results, correct:r16Correct, total:8 },
                { label:'QF',  picks:state.qf,  actuals:results?.qf_results,  correct:qfCorrect,  total:4 },
                { label:'SF',  picks:state.sf,  actuals:results?.sf_results,  correct:sfCorrect,  total:2 },
              ].map(({ label, picks, actuals, correct, total }) => {
                const made = picks.map((p, i) => ({ nm: p, i })).filter(x => x.nm)
                if (!made.length) return null
                return (
                  <div key={label}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, color:'var(--ink-3)', letterSpacing:'0.8px' }}>{label}</span>
                      {hasResults && actuals?.some(Boolean) && <span style={{ fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, color:'var(--win)' }}>{correct}/{total}</span>}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {made.map(({ nm, i }) => {
                        const t = teamByName(nm!)
                        const isCorrect = actuals ? (nm === actuals[i] ? true : actuals[i] ? false : null) : null
                        return (
                          <span key={`${nm}-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:12,
                            background: isCorrect === true ? 'color-mix(in srgb,var(--win) 10%,var(--surface-2))' : isCorrect === false ? 'color-mix(in srgb,var(--live) 8%,var(--surface-2))' : 'var(--surface-2)',
                            border: `1px solid ${isCorrect === true ? 'color-mix(in srgb,var(--win) 28%,var(--line))' : isCorrect === false ? 'color-mix(in srgb,var(--live) 22%,var(--line))' : 'var(--line)'}`,
                            fontFamily:'var(--f-body)', fontSize:11, fontWeight:600, color:'var(--ink)' }}>
                            {t.f} {nm}
                            {isCorrect !== null && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:800, color: isCorrect ? 'var(--win)' : 'var(--live)' }}>{isCorrect ? '✓' : '✗'}</span>}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`@media(min-width:480px){.rev-grid{grid-template-columns:repeat(3,1fr)!important}}@media(min-width:720px){.rev-grid{grid-template-columns:repeat(4,1fr)!important}}`}</style>
    </div>
  )
}
