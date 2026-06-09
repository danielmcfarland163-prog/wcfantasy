'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Flag, { isoForTeam } from '@/components/ui/Flag'
import LockCountdown from '@/components/LockCountdown'
import {
  GROUPS, GROUP_KEYS, BracketState, type BracketMode,
  teamByName, getModeMatchTeams, setPick,
  pickGroup, pickThird, thirdCandidates,
  groupsComplete, thirdComplete, stateToDb,
  bracketModeOpen, isBracketModeLocked, reconcileKnockout,
  isGroupLocked,
  TOURNAMENT_LOCK, KNOCKOUT_LOCK,
  pickGroupPickem, pickThirdPickem, survivorComplete,
  survivorCandidates, survivorPicks, toggleSurvivor, SURVIVOR_COUNTS, type SurvivorRound,
} from '@/lib/bracket'
import { scoreBracketEntry, BRACKET_PTS, knockoutPickCorrect } from '@/lib/bracket-scoring'

const fmtLock = (d: Date) =>
  d.toLocaleString('en-GB', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', hour12: false,
  }) + ' UTC'
const LOCK_LABEL = fmtLock(TOURNAMENT_LOCK)
const KO_LOCK_LABEL = fmtLock(KNOCKOUT_LOCK)

type Tab = 'groups' | 'third' | 'bracket' | 'standings' | 'summary'
interface TournamentResults {
  group_results: Record<string, { first: string; second: string; third: string }>
  third_quals: string[]
  r32_results: (string | null)[]
  r16_results: (string | null)[]
  qf_results:  (string | null)[]
  sf_results:  (string | null)[]
  final_result: string | null
}

interface Props { userId: string; mode: BracketMode; initialState: BracketState; tournamentResults?: TournamentResults | null }

const GC: Record<string, string> = {
  A:'#2f6fe0',B:'#1f9d5a',C:'#e03c2c',D:'#c98a1a',
  E:'#7c3aed',F:'#0891b2',G:'#db2777',H:'#059669',
  I:'#d97706',J:'#4f46e5',K:'#dc2626',L:'#0d9488',
}

export default function BracketClient({ userId, mode, initialState, tournamentResults }: Props) {
  // Stable client — created once, not on every render
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<BracketState>(initialState)
  const isPickem = mode === 'pickem'
  const groupLocked = isGroupLocked()
  // Mode-aware. pickem: the knockout is seeded from the player's OWN groups and
  // everything locks at the group lock. reset: the knockout opens from the real
  // results and locks at the knockout lock.
  const bracketOpen = bracketModeOpen(mode, state, tournamentResults)
  const bracketLocked = isBracketModeLocked(mode)
  const bracketLockLabel = isPickem ? LOCK_LABEL : KO_LOCK_LABEL
  const hasResults = !!(tournamentResults && Object.keys(tournamentResults.group_results ?? {}).length > 0)
  // Landing tab: bracket open & editable → Bracket; locked with results → Summary; else Groups.
  const [tab, setTab] = useState<Tab>(
    bracketOpen && !bracketLocked ? 'bracket'
    : groupLocked && hasResults ? 'summary'
    : 'groups',
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((s: BracketState) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      const { error } = await supabase
        .from('bracket_entries')
        .upsert(
          { user_id: userId, mode, ...stateToDb(s), updated_at: new Date().toISOString() },
          { onConflict: 'user_id,mode' }
        )
      setSaving(false)
      if (error) {
        console.error('Bracket save error:', error)
        if ((error as any).code === '42P01') {
          showToast('Table missing — run schema-bracket.sql in Supabase')
        } else if ((error as any).code === '42501' || error.message?.includes('row-level security')) {
          showToast('Save blocked by RLS — check bracket_entries policy')
        } else {
          showToast(`Save failed: ${error.message ?? error.code ?? 'unknown'}`)
        }
      }
    }, 600)
  }, [userId, mode, supabase])

  function update(s: BracketState) { setState(s); save(s) }
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // Reset mode only: when the knockout opens, prune any stored knockout picks that
  // aren't real participants of the actual R32 (legacy picks seeded off the user's
  // own predicted groups). Pickem keeps its self-seeded picks as-is. Runs once.
  const reconciledRef = useRef(false)
  useEffect(() => {
    if (reconciledRef.current || mode !== 'reset' || !bracketOpen || bracketLocked) return
    reconciledRef.current = true
    const next = reconcileKnockout(state, tournamentResults)
    if (JSON.stringify(next) !== JSON.stringify(state)) update(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracketOpen, bracketLocked])

  const groupsDone  = groupsComplete(state)
  const thirdDone   = thirdComplete(state)
  // pickem is a survivor pool — "done" means all 31 slots filled, not just a champion.
  const bracketDone = isPickem ? survivorComplete(state) : !!state.final
  const doneCount   = GROUP_KEYS.filter(gk => state.gp[gk]?.first && state.gp[gk]?.second).length
  const bracketPicks = [...state.r32, ...state.r16, ...state.qf, ...state.sf, state.final].filter(Boolean).length

  const bracketBadge = !bracketOpen ? '🔒'
    : bracketDone ? '✓'
    : bracketPicks > 0 ? `${bracketPicks}/31` : undefined

  const tabs: { key: Tab; label: string; disabled?: boolean; badge?: string }[] = [
    { key: 'groups',   label: 'Groups',    badge: groupsDone ? '✓' : `${doneCount}/12` },
    { key: 'third',    label: '3rd Place', badge: thirdDone ? '✓' : `${state.tq.length}/8`, disabled: !groupsDone },
    { key: 'bracket',  label: 'Bracket',   badge: bracketBadge },
    ...(hasResults ? [{ key: 'standings' as Tab, label: 'Standings' }] : []),
    { key: 'summary',  label: 'Summary' },
  ]

  // Mode-aware banner.
  const banner = (() => {
    if (isPickem) {
      // Up-front pick'em: one lock at the group lock (first kickoff).
      if (bracketLocked) {
        return (
          <div style={{ margin:'0 0 16px', padding:'10px 14px', background:'color-mix(in srgb,var(--gold) 10%,var(--surface))', border:'1px solid color-mix(in srgb,var(--gold) 30%,var(--line))', borderRadius:12, fontFamily:'var(--f-mono)', fontSize:11, color:'var(--gold)', fontWeight:700 }}>
            🔒 Pick’em bracket locked — tournament in progress. Read-only.
          </div>
        )
      }
      return <LockCountdown />
    }
    // Reset: group countdown → group-locked notice → knockout notice → fully-locked.
    if (bracketLocked) {
      return (
        <div style={{ margin:'0 0 16px', padding:'10px 14px', background:'color-mix(in srgb,var(--gold) 10%,var(--surface))', border:'1px solid color-mix(in srgb,var(--gold) 30%,var(--line))', borderRadius:12, fontFamily:'var(--f-mono)', fontSize:11, color:'var(--gold)', fontWeight:700 }}>
          🔒 Bracket locked — knockout stage underway. Read-only.
        </div>
      )
    }
    if (bracketOpen) {
      return (
        <div style={{ margin:'0 0 16px', padding:'12px 16px', background:'linear-gradient(135deg,color-mix(in srgb,var(--accent) 12%,var(--surface)),color-mix(in srgb,var(--accent) 4%,var(--surface)))', border:'1.5px solid color-mix(in srgb,var(--accent) 32%,var(--line))', borderRadius:14 }}>
          <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:15, color:'var(--ink)' }}>⚽ Group stage complete — fill your knockout bracket</div>
          <div style={{ fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-2)', marginTop:2 }}>
            The Round of 32 is set from the real results. Pick your winners through to the final — locks <strong style={{ color:'var(--ink)' }}>{KO_LOCK_LABEL}</strong>.
          </div>
        </div>
      )
    }
    if (groupLocked) {
      return (
        <div style={{ margin:'0 0 16px', padding:'12px 16px', background:'color-mix(in srgb,var(--gold) 9%,var(--surface))', border:'1px solid color-mix(in srgb,var(--gold) 28%,var(--line))', borderRadius:14 }}>
          <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:15, color:'var(--ink)' }}>🔒 Group picks locked — group stage in progress</div>
          <div style={{ fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-2)', marginTop:2 }}>
            Your knockout bracket opens here once the group stage finishes and the Round of 32 is set.
          </div>
        </div>
      )
    }
    return <LockCountdown />
  })()

  return (
    <div>
      {banner}
      {saving && (
        <div style={{ position:'fixed', top:16, right:16, zIndex:50, background:'var(--win)', color:'#fff', fontSize:11, fontFamily:'var(--f-mono)', fontWeight:700, padding:'5px 12px', borderRadius:20, boxShadow:'0 4px 12px rgba(31,157,90,0.4)' }}>
          Saving…
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--line)', marginBottom:20, overflowX:'auto' }} className="wc-noscroll">
        {tabs.map(({ key, label, disabled, badge }) => (
          <button key={key} onClick={() => !disabled && setTab(key)} disabled={disabled}
            style={{ flex:1, minWidth:80, padding:'10px 8px', border:'none', background:'transparent', cursor:disabled?'not-allowed':'pointer', fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, color:tab===key?'var(--accent)':disabled?'var(--ink-3)':'var(--ink-2)', opacity:disabled?0.45:1, position:'relative', whiteSpace:'nowrap', transition:'color .15s', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            {label}
            {badge && (
              <span style={{ fontSize:10, fontFamily:'var(--f-mono)', fontWeight:700, padding:'1px 5px', borderRadius:10, background:badge==='✓'?'color-mix(in srgb,var(--win) 15%,transparent)':'var(--surface-2)', color:badge==='✓'?'var(--win)':'var(--ink-3)' }}>
                {badge}
              </span>
            )}
            {tab===key && <span style={{ position:'absolute', bottom:-2, left:0, right:0, height:2, background:'var(--accent)', borderRadius:'2px 2px 0 0' }} />}
          </button>
        ))}
      </div>

      {tab==='groups'  && <GroupsTab  state={state} mode={mode} locked={groupLocked} onUpdate={update} onNext={() => setTab('third')} results={tournamentResults} />}
      {tab==='third'   && <ThirdTab   state={state} mode={mode} locked={groupLocked} onUpdate={update} onNext={() => setTab(bracketOpen ? 'bracket' : 'summary')} onToast={showToast} results={tournamentResults} />}
      {tab==='bracket'  && (isPickem
        ? <SurvivorTab state={state} locked={bracketLocked} bracketOpen={bracketOpen} onUpdate={update} onComplete={() => setTab('summary')} results={tournamentResults} />
        : <BracketTab  state={state} mode={mode} locked={bracketLocked} bracketOpen={bracketOpen} onUpdate={update} onComplete={() => setTab('summary')} results={tournamentResults} />)}
      {tab==='standings' && <StandingsTab results={tournamentResults ?? null} />}
      {tab==='summary'  && <SummaryTab state={state} mode={mode} onGoTo={setTab} results={tournamentResults ?? null} groupLocked={groupLocked} bracketLocked={bracketLocked} bracketOpen={bracketOpen} bracketLockLabel={bracketLockLabel} submitted={submitted} onSubmit={() => { setSubmitted(true); showToast(isPickem ? 'Bracket locked in — editable until kickoff' : 'Knockout bracket locked in — editable until kickoff') }} />}

      {toast && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:'var(--ink)', color:'#fff', fontSize:13, fontFamily:'var(--f-body)', padding:'8px 20px', borderRadius:24, boxShadow:'0 8px 24px rgba(0,0,0,0.25)', zIndex:50, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── GROUPS TAB ─────────────────────────────────────────────────────────────────

function GroupsTab({ state, mode, locked, onUpdate, onNext, results }: { state:BracketState; mode:BracketMode; locked:boolean; onUpdate:(s:BracketState)=>void; onNext:()=>void; results?: TournamentResults | null }) {
  const doGroupPick = mode === 'pickem' ? pickGroupPickem : pickGroup
  const groupsDone = groupsComplete(state)
  const doneCount = GROUP_KEYS.filter(gk => state.gp[gk]?.first && state.gp[gk]?.second).length

  return (
    <div>
      {/* Progress bar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, marginBottom:20 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:doneCount===12?'color-mix(in srgb,var(--win) 15%,transparent)':'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:18, color:doneCount===12?'var(--win)':'var(--ink-2)' }}>{doneCount===12?'✓':doneCount}</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, color:'var(--ink)', marginBottom:5 }}>
            {doneCount===12?'All groups complete!':`${doneCount} of 12 groups done`}
          </div>
          <div style={{ height:5, borderRadius:3, background:'var(--line)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(doneCount/12)*100}%`, borderRadius:3, background:doneCount===12?'var(--win)':'var(--accent)', transition:'width .3s' }} />
          </div>
        </div>
        <div style={{ fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-3)', flexShrink:0 }}>{doneCount}/12</div>
      </div>

      <p style={{ fontFamily:'var(--f-body)', fontSize:12, color:'var(--ink-3)', marginBottom:16 }}>
        Click once for 1st, again for 2nd. Click a selected team to deselect.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }} className="bc-grid">
        {GROUP_KEYS.map(gk => {
          const grp = GROUPS[gk]
          const p = state.gp[gk] ?? {}
          const done = !!(p.first && p.second)
          const color = GC[gk]
          return (
            <div key={gk} style={{ background:'var(--surface)', border:done?`1.5px solid color-mix(in srgb,${color} 40%,var(--line))`:'1px solid var(--line)', borderRadius:16, overflow:'hidden', boxShadow:done?`0 4px 12px -6px ${color}44`:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:color }}>
                <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:15, color:'#fff' }}>Group {gk}</span>
                <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:8, background:done?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.15)', color:'#fff' }}>
                  {done?'✓ Done':'Pick 2'}
                </span>
              </div>
              {grp.teams.map((tm, idx) => {
                const is1 = p.first===tm.n, is2 = p.second===tm.n
                return (
                  <button key={tm.n} disabled={locked} onClick={() => onUpdate(doGroupPick(state, gk, tm.n))}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 14px', textAlign:'left', border:'none', borderTop:idx>0?'1px solid var(--line)':'none', background:is1?'color-mix(in srgb,var(--gold) 8%,var(--surface))':is2?'color-mix(in srgb,var(--ink) 4%,var(--surface))':'var(--surface)', cursor:locked?'default':'pointer', transition:'background .12s' }}>
                    <Flag iso={isoForTeam(tm.c)} size={22} radius={5} ring={false} alt={tm.n} />
                    <span style={{ flex:1, fontFamily:'var(--f-body)', fontWeight:600, fontSize:14, color:'var(--ink)' }}>{tm.n}</span>
                    <span style={{ width:32, height:22, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:'var(--f-mono)', fontWeight:700, fontSize:10, background:is1?'var(--gold)':is2?'color-mix(in srgb,var(--ink) 18%,transparent)':'var(--surface-2)', color:is1?'#fff':is2?'var(--ink)':'var(--ink-3)' }}>
                      {is1?'1ST':is2?'2ND':'·'}
                    </span>
                    {(is1 || is2) && results?.group_results[gk]?.first && (() => {
                      const actual = results.group_results[gk]
                      const correct = (is1 && p.first === actual.first) || (is2 && p.second === actual.second)
                      return <span style={{ fontFamily:'var(--f-mono)', fontWeight:800, fontSize:12, color: correct ? 'var(--win)' : 'var(--live)', flexShrink:0 }}>{correct ? '✓' : '✗'}</span>
                    })()}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {groupsDone && (
        <button onClick={onNext} className="btn-primary" style={{ width:'100%', marginTop:24, padding:'14px', fontSize:15 }}>
          Next: Pick 3rd-Place Qualifiers →
        </button>
      )}

      <style>{`@media(min-width:600px){.bc-grid{grid-template-columns:repeat(2,1fr)!important}}@media(min-width:960px){.bc-grid{grid-template-columns:repeat(3,1fr)!important}}`}</style>
    </div>
  )
}

// ── THIRD PLACE TAB ────────────────────────────────────────────────────────────

function ThirdTab({ state, mode, locked, onUpdate, onNext, onToast, results }: { state:BracketState; mode:BracketMode; locked:boolean; onUpdate:(s:BracketState)=>void; onNext:()=>void; onToast:(m:string)=>void; results?: TournamentResults | null }) {
  const done = thirdComplete(state)
  const doThirdPick = mode === 'pickem' ? pickThirdPickem : pickThird

  function handlePick(gk: string, nm: string) {
    if (state.tp[gk]!==nm && state.tq.length>=8 && !state.tq.includes(nm)) { onToast('Already 8 — remove one first'); return }
    onUpdate(doThirdPick(state, gk, nm))
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, gap:12 }}>
        <div>
          <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:20, color:'var(--ink)' }}>3rd-Place Qualifiers</div>
          <p style={{ fontFamily:'var(--f-body)', fontSize:12, color:'var(--ink-3)', marginTop:4 }}>
            Pick the best 3rd-place finisher from each group. 8 will advance to the bracket.
          </p>
        </div>
        <div style={{ flexShrink:0, width:52, height:52, borderRadius:14, background:done?'color-mix(in srgb,var(--win) 12%,transparent)':'var(--surface-2)', border:`1.5px solid ${done?'color-mix(in srgb,var(--win) 30%,var(--line))':'var(--line)'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:20, color:done?'var(--win)':'var(--ink-2)' }}>
            {done?'✓':`${state.tq.length}/8`}
          </span>
        </div>
      </div>

      {state.tq.length>0 && (
        <div style={{ padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, marginBottom:20 }}>
          <div style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.8px', marginBottom:10 }}>
            YOUR QUALIFIERS ({state.tq.length}/8)
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {state.tq.map((nm, i) => {
              const t = teamByName(nm)
              const correct = results?.third_quals?.length
                ? results.third_quals.includes(nm)
                : null
              return (
                <span key={nm} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20,
                  background: correct === true ? 'color-mix(in srgb,var(--win) 12%,transparent)' : correct === false ? 'color-mix(in srgb,var(--live) 8%,transparent)' : 'color-mix(in srgb,var(--win) 10%,transparent)',
                  border: `1px solid ${correct === true ? 'color-mix(in srgb,var(--win) 30%,var(--line))' : correct === false ? 'color-mix(in srgb,var(--live) 25%,var(--line))' : 'color-mix(in srgb,var(--win) 25%,var(--line))'}`,
                  fontFamily:'var(--f-body)', fontSize:13, fontWeight:600, color:'var(--ink)' }}>
                  <span style={{ color:'var(--ink-3)', fontFamily:'var(--f-mono)', fontSize:9 }}>#{i+1}</span>
                  <span>{t.f}</span><span>{nm}</span>
                  {correct !== null && <span style={{ fontFamily:'var(--f-mono)', fontSize:11, fontWeight:800, color: correct ? 'var(--win)' : 'var(--live)' }}>{correct ? '✓' : '✗'}</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:10 }} className="bc-grid">
        {GROUP_KEYS.map(gk => {
          const cands = thirdCandidates(state, gk)
          const cur = state.tp[gk]
          const isQ = !!(cur && state.tq.includes(cur))
          const color = GC[gk]
          return (
            <div key={gk} style={{ background:'var(--surface)', border:isQ?'1.5px solid color-mix(in srgb,var(--win) 35%,var(--line))':'1px solid var(--line)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface-2)', borderBottom:'1px solid var(--line)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:20, height:20, borderRadius:6, background:color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:11, color:'#fff' }}>{gk}</span>
                  </div>
                  <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--ink-3)', letterSpacing:'0.5px' }}>GROUP {gk} — 3RD</span>
                </div>
                {isQ && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, background:'color-mix(in srgb,var(--win) 15%,transparent)', color:'var(--win)' }}>ADVANCES ✓</span>}
              </div>
              {cands.map((tm, idx) => {
                const isCur = cur===tm.n
                const isQual = isCur && state.tq.includes(tm.n)
                return (
                  <button key={tm.n} disabled={locked} onClick={() => handlePick(gk, tm.n)}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', textAlign:'left', border:'none', borderTop:idx>0?'1px solid var(--line)':'none', background:isQual?'color-mix(in srgb,var(--win) 7%,var(--surface))':isCur?'color-mix(in srgb,var(--accent) 6%,var(--surface))':'var(--surface)', cursor:locked?'default':'pointer' }}>
                    <span style={{ fontSize:20 }}>{tm.f}</span>
                    <span style={{ flex:1, fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>{tm.n}</span>
                    {isCur && (
                      results?.third_quals?.length
                        ? <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color: results.third_quals.includes(tm.n) ? 'var(--win)' : 'var(--live)' }}>
                            {results.third_quals.includes(tm.n) ? 'ADV ✓' : '✗ OUT'}
                          </span>
                        : isQual
                          ? <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--win)' }}>ADV ✓</span>
                          : <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--accent)' }}>3RD</span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {done && (
        <button onClick={onNext} className="btn-primary" style={{ width:'100%', marginTop:24, padding:'14px', fontSize:15 }}>
          Done — review my picks →
        </button>
      )}
      <style>{`@media(min-width:600px){.bc-grid{grid-template-columns:repeat(2,1fr)!important}}@media(min-width:960px){.bc-grid{grid-template-columns:repeat(3,1fr)!important}}`}</style>
    </div>
  )
}

// ── BRACKET TAB ────────────────────────────────────────────────────────────────

const ROUNDS = [
  { key:'r32', label:'R32', n:16 }, { key:'r16', label:'R16', n:8 },
  { key:'qf',  label:'QF',  n:4  }, { key:'sf',  label:'SF',  n:2 },
  { key:'final', label:'Final', n:1 },
]

function getPicks(state: BracketState, rKey: string): (string|null)[] {
  if (rKey==='r32') return state.r32
  if (rKey==='r16') return state.r16
  if (rKey==='qf')  return state.qf
  if (rKey==='sf')  return state.sf
  if (rKey==='final') return [state.final]
  return []
}

function getActuals(results: TournamentResults | null | undefined, rKey: string): (string | null)[] {
  if (!results) return []
  if (rKey === 'r32')   return results.r32_results
  if (rKey === 'r16')   return results.r16_results
  if (rKey === 'qf')    return results.qf_results
  if (rKey === 'sf')    return results.sf_results
  if (rKey === 'final') return [results.final_result]
  return []
}

function BracketTab({ state, mode, locked, bracketOpen, onUpdate, onComplete, results }: { state:BracketState; mode:BracketMode; locked:boolean; bracketOpen:boolean; onUpdate:(s:BracketState)=>void; onComplete:()=>void; results?: TournamentResults | null }) {
  const isPickem = mode === 'pickem'
  if (!bracketOpen) {
    return (
      <div style={{ padding:'48px 24px', textAlign:'center', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:20 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>{isPickem ? '🗂' : '🔒'}</div>
        <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:20, color:'var(--ink)', marginBottom:8 }}>
          {isPickem ? 'Complete your group picks first' : 'Knockout bracket opens after the group stage'}
        </div>
        <p style={{ fontFamily:'var(--f-body)', fontSize:14, color:'var(--ink-2)', maxWidth:340, margin:'0 auto' }}>
          {isPickem
            ? 'Pick 1st and 2nd from all 12 groups to populate your knockout bracket from your own predicted standings.'
            : 'Once all 12 groups finish and the Round of 32 is set, the real bracket unlocks here and everyone picks their knockout winners through to the final.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontFamily:'var(--f-body)', fontSize:12, color:'var(--ink-3)', marginBottom:16 }}>
        {isPickem
          ? 'Your Round of 32 is seeded from your own group picks. Click a team to advance them — changes cascade, so altering an earlier round clears downstream picks.'
          : 'The Round of 32 is seeded from the actual group results. Click a team to advance them — changes cascade, so altering an earlier round clears downstream picks.'}
      </p>

      <div style={{ overflowX:'auto', marginBottom:24, borderRadius:16, border:'1px solid var(--line)', background:'var(--surface)' }} className="wc-noscroll">
        <div style={{ display:'flex', minWidth:640, height:760 }}>
          {ROUNDS.map(({ key:rKey, label, n }, ri) => {
            const picks = getPicks(state, rKey)
            return (
              <div key={rKey} style={{ flex:rKey==='final'?1.2:1, minWidth:rKey==='final'?130:115, display:'flex', flexDirection:'column', borderRight:ri<ROUNDS.length-1?'1px solid var(--line)':'none' }}>
                <div style={{ height:40, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-2)', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
                  <span style={{ fontFamily:'var(--f-mono)', fontWeight:700, fontSize:10, color:'var(--accent)', letterSpacing:'1.2px', textTransform:'uppercase' }}>{label}</span>
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'space-around', padding:'8px 5px' }}>
                  {Array.from({ length:n }).map((_, i) => {
                    const { h, a } = getModeMatchTeams(mode, state, results, rKey, i)
                    const pick = picks[i] ?? null
                    const actuals = getActuals(results, rKey)
                    return (
                      <MatchNode key={i} home={h} away={a} pick={pick} locked={locked} isFinal={rKey==='final'}
                        actualWinner={actuals[i] ?? null}
                        onPick={(nm) => {
                          const next = setPick(state, rKey, i, nm)
                          onUpdate(next)           // save the pick with champion included
                          if (rKey === 'final') onComplete()  // onComplete only navigates, no save
                        }} />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {state.final && (
        <div style={{ padding:'24px 20px', background:'linear-gradient(135deg,color-mix(in srgb,var(--gold) 12%,var(--surface)),color-mix(in srgb,var(--gold) 4%,var(--surface)))', border:'1.5px solid color-mix(in srgb,var(--gold) 35%,var(--line))', borderRadius:20, textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:8 }}>{teamByName(state.final).f}</div>
          <div style={{ fontFamily:'var(--f-mono)', fontSize:10, letterSpacing:'2px', color:'var(--gold)', fontWeight:700, marginBottom:6 }}>YOUR 2026 CHAMPION</div>
          <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:28, color:'var(--ink)' }}>{state.final}</div>
          {!locked && (
            <button onClick={onComplete} className="btn-primary" style={{ marginTop:16, padding:'11px 24px', fontSize:14, fontWeight:700 }}>
              Review &amp; submit →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function MatchNode({ home, away, pick, locked, isFinal, onPick, actualWinner }: {
  home:{n:string;f:string;c:string}|null; away:{n:string;f:string;c:string}|null
  pick:string|null; locked:boolean; isFinal:boolean; onPick:(nm:string)=>void
  actualWinner?: string | null
}) {
  const hasResult = !!actualWinner
  const isPickCorrect = hasResult && !!pick ? pick === actualWinner : null

  const borderColor = isPickCorrect === true
    ? 'color-mix(in srgb,var(--win) 40%,var(--line))'
    : isPickCorrect === false
    ? 'color-mix(in srgb,var(--live) 30%,var(--line))'
    : pick ? 'color-mix(in srgb,var(--accent) 30%,var(--line))' : 'var(--line)'

  return (
    <div style={{ border:`${isPickCorrect !== null || pick ? '1.5px' : '1px'} solid ${borderColor}`, borderRadius:9, overflow:'hidden', background:'var(--surface)', boxShadow:pick?'0 2px 8px -4px rgba(47,111,224,0.2)':'none' }}>
      {[home, away].map((team, idx) => {
        if (!team) return (
          <div key={idx} style={{ padding:'5px 8px', borderBottom:idx===0?'1px solid var(--line)':'none', display:'flex', alignItems:'center', minHeight:isFinal?40:28, opacity:0.4 }}>
            <span style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--ink-3)', fontStyle:'italic' }}>TBD</span>
          </div>
        )
        const isWinner = pick === team.n
        const isActualWinner = actualWinner === team.n
        const isLoser = !!(pick && pick !== team.n)

        let bg = 'transparent'
        let textColor = isWinner ? 'var(--accent)' : 'var(--ink-2)'
        let opacity: number = isLoser ? 0.25 : 1

        if (isWinner) {
          if (isPickCorrect === true)  { bg = 'color-mix(in srgb,var(--win) 12%,var(--surface))';  textColor = 'var(--win)' }
          else if (isPickCorrect === false) { bg = 'color-mix(in srgb,var(--live) 8%,var(--surface))'; textColor = 'var(--live)' }
          else { bg = 'color-mix(in srgb,var(--accent) 10%,var(--surface))' }
        } else if (isActualWinner && hasResult && pick) {
          // show who actually won when user picked wrong
          bg = 'color-mix(in srgb,var(--win) 6%,var(--surface))'
          textColor = 'var(--win)'
          opacity = 1
        }

        const iconEl = isWinner
          ? <span style={{ color: isPickCorrect === true ? 'var(--win)' : isPickCorrect === false ? 'var(--live)' : 'var(--accent)', fontSize:8, flexShrink:0 }}>
              {isPickCorrect === true ? '✓' : isPickCorrect === false ? '✗' : '▶'}
            </span>
          : (isActualWinner && hasResult && pick)
            ? <span style={{ color:'var(--win)', fontSize:7, flexShrink:0 }}>★</span>
            : null

        return (
          <button key={idx} disabled={locked||!home||!away} onClick={() => onPick(team.n)}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:5, padding:isFinal?'7px 8px':'4px 7px', minHeight:isFinal?40:28, borderBottom:idx===0?'1px solid var(--line)':'none', border:'none', background:bg, cursor:locked||!home||!away?'default':'pointer', textAlign:'left', opacity, transition:'background .1s,opacity .1s' }}>
            <Flag iso={isoForTeam(team.c)} size={isFinal?24:16} radius={isFinal?5:3} ring={false} alt={team.n} />
            <span style={{ flex:1, fontFamily:'var(--f-mono)', fontWeight:isWinner?700:400, fontSize:isFinal?12:9, color:textColor, letterSpacing:'0.5px', lineHeight:1 }}>{isFinal ? team.n : team.c}</span>
            {iconEl}
          </button>
        )
      })}
    </div>
  )
}

// ── SURVIVOR TAB (Pick'em) ──────────────────────────────────────────────────────
// Pick WHICH teams advance each round, narrowing your own pool — no matchups, so a
// missed group pick never cascades. 32 → 16 → 8 → 4 → 2 → champion.

const SURVIVOR_ROUNDS: { key: SurvivorRound; reach: string }[] = [
  { key:'r32',   reach:'Round of 16' },
  { key:'r16',   reach:'Quarter-finals' },
  { key:'qf',    reach:'Semi-finals' },
  { key:'sf',    reach:'Final' },
  { key:'final', reach:'Champion' },
]

function SurvivorTab({ state, locked, bracketOpen, onUpdate, onComplete, results }: {
  state:BracketState; locked:boolean; bracketOpen:boolean
  onUpdate:(s:BracketState)=>void; onComplete:()=>void; results?: TournamentResults | null
}) {
  if (!bracketOpen) {
    return (
      <div style={{ padding:'48px 24px', textAlign:'center', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:20 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🗂</div>
        <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:20, color:'var(--ink)', marginBottom:8 }}>Complete your group picks first</div>
        <p style={{ fontFamily:'var(--f-body)', fontSize:14, color:'var(--ink-2)', maxWidth:360, margin:'0 auto' }}>
          Pick 1st and 2nd in all 12 groups (plus your 8 third-place qualifiers) to fill your pool of 32. Then choose which teams advance each round.
        </p>
      </div>
    )
  }

  const poolReady = survivorCandidates(state, 'r32').length

  return (
    <div>
      <div style={{ margin:'0 0 16px', padding:'12px 16px', background:'color-mix(in srgb,var(--accent) 6%,var(--surface))', border:'1px solid color-mix(in srgb,var(--accent) 22%,var(--line))', borderRadius:14 }}>
        <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:15, color:'var(--ink)' }}>Pick who advances — no matchups</div>
        <div style={{ fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-2)', marginTop:2, lineHeight:1.5 }}>
          From your {poolReady} qualifiers, narrow the field each round: 16 → 8 → 4 → 2 → champion. A team only has to <em>reach</em> the round — who they play doesn&rsquo;t matter, so a missed group pick never breaks your bracket.
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {SURVIVOR_ROUNDS.map((r, ri) => {
          const cands = survivorCandidates(state, r.key)
          const picks = survivorPicks(state, r.key)
          const pickSet = new Set(picks)
          const cap = SURVIVOR_COUNTS[r.key]
          const actuals = getActuals(results, r.key)
          const hasRes = actuals.some(Boolean)
          const correct = hasRes ? picks.filter(nm => knockoutPickCorrect(nm, 0, actuals, true) === true).length : 0
          const full = picks.length >= cap
          const prevEmpty = cands.length === 0

          return (
            <div key={r.key} style={{ background:'var(--surface)', border: full ? '1.5px solid color-mix(in srgb,var(--accent) 35%,var(--line))' : '1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:'var(--surface-2)', borderBottom:'1px solid var(--line)' }}>
                <div>
                  <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:16, color:'var(--ink)' }}>{r.reach}</div>
                  <div style={{ fontFamily:'var(--f-mono)', fontSize:9.5, color:'var(--ink-3)', letterSpacing:'0.4px', marginTop:1 }}>
                    {r.key==='final' ? 'PICK YOUR CHAMPION' : `PICK ${cap} TO REACH THE ${r.reach.toUpperCase()}`}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {hasRes && <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--win)' }}>{correct}/{cap}</span>}
                  <span style={{ fontFamily:'var(--f-mono)', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:10, background: full ? 'color-mix(in srgb,var(--accent) 14%,transparent)' : 'var(--surface)', color: full ? 'var(--accent)' : 'var(--ink-3)', border: full ? 'none' : '1px solid var(--line)' }}>
                    {picks.length}/{cap}
                  </span>
                </div>
              </div>

              {prevEmpty ? (
                <div style={{ padding:'16px', fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-3)', textAlign:'center' }}>
                  Pick your {SURVIVOR_ROUNDS[ri-1]?.reach ?? 'qualifiers'} first.
                </div>
              ) : (
                <div style={{ padding:'12px', display:'flex', flexWrap:'wrap', gap:7 }}>
                  {cands.map(nm => {
                    const t = teamByName(nm)
                    const on = pickSet.has(nm)
                    const verdict = on && hasRes ? knockoutPickCorrect(nm, 0, actuals, true) : null
                    const disabled = locked || (!on && full && cap > 1)
                    const bg = verdict === true ? 'color-mix(in srgb,var(--win) 14%,var(--surface))'
                      : verdict === false ? 'color-mix(in srgb,var(--live) 10%,var(--surface))'
                      : on ? 'var(--accent)' : 'var(--surface)'
                    const fg = verdict === true ? 'var(--win)' : verdict === false ? 'var(--live)' : on ? '#fff' : 'var(--ink)'
                    const bd = verdict === true ? 'color-mix(in srgb,var(--win) 35%,var(--line))'
                      : verdict === false ? 'color-mix(in srgb,var(--live) 30%,var(--line))'
                      : on ? 'var(--accent)' : 'var(--line)'
                    return (
                      <button key={nm} disabled={disabled}
                        onClick={() => { const next = toggleSurvivor(state, r.key, nm); onUpdate(next); if (r.key==='final' && next.final) onComplete() }}
                        style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:11,
                          border:`${on && verdict===null ? '1.5px' : '1px'} solid ${bd}`, background:bg, color:fg,
                          cursor:disabled?'default':'pointer', opacity: disabled && !on ? 0.4 : 1,
                          fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, transition:'all .12s' }}>
                        <span style={{ fontSize:15 }}>{t.f}</span>
                        <span>{nm}</span>
                        {verdict===true && <span style={{ fontFamily:'var(--f-mono)', fontSize:11, fontWeight:800 }}>✓</span>}
                        {verdict===false && <span style={{ fontFamily:'var(--f-mono)', fontSize:11, fontWeight:800 }}>✗</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {state.final && (
        <div style={{ marginTop:18, padding:'24px 20px', background:'linear-gradient(135deg,color-mix(in srgb,var(--gold) 12%,var(--surface)),color-mix(in srgb,var(--gold) 4%,var(--surface)))', border:'1.5px solid color-mix(in srgb,var(--gold) 35%,var(--line))', borderRadius:20, textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:8 }}>{teamByName(state.final).f}</div>
          <div style={{ fontFamily:'var(--f-mono)', fontSize:10, letterSpacing:'2px', color:'var(--gold)', fontWeight:700, marginBottom:6 }}>YOUR CHAMPION</div>
          <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:28, color:'var(--ink)' }}>{state.final}</div>
          {!locked && (
            <button onClick={onComplete} className="btn-primary" style={{ marginTop:16, padding:'11px 24px', fontSize:14, fontWeight:700 }}>
              Review &amp; submit →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── SUMMARY TAB ────────────────────────────────────────────────────────────────

function ResultBadge({ pick, actual }: { pick: string | null | undefined; actual: string | null | undefined }) {
  if (!actual) return null
  if (!pick) return <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--ink-3)' }}>—</span>
  const correct = pick === actual
  return (
    <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:800, color: correct ? 'var(--win)' : 'var(--live)', flexShrink:0 }}>
      {correct ? '✓' : '✗'}
    </span>
  )
}

function SummaryTab({ state, mode, onGoTo, results, groupLocked, bracketLocked, bracketOpen, bracketLockLabel, submitted, onSubmit }: { state:BracketState; mode:BracketMode; onGoTo:(t:Tab)=>void; results: TournamentResults | null; groupLocked:boolean; bracketLocked:boolean; bracketOpen:boolean; bracketLockLabel:string; submitted:boolean; onSubmit:()=>void }) {
  const groupsDone = groupsComplete(state)
  const thirdDone  = thirdComplete(state)
  const groupPhaseDone = groupsDone && thirdDone
  const knockoutDone = mode === 'pickem' ? survivorComplete(state) : !!state.final
  const bracketPicks = [...state.r32,...state.r16,...state.qf,...state.sf,state.final].filter(Boolean).length
  const doneCount = GROUP_KEYS.filter(gk => state.gp[gk]?.first && state.gp[gk]?.second).length
  const hasResults = !!results

  const isPickem = mode === 'pickem'

  // Shared scoring engine — identical to the server (lib/bracket-scoring.ts).
  // Mode-aware: pickem scores knockout picks by survivor set-membership, reset by
  // bracket position.
  const score = results ? scoreBracketEntry(stateToDb(state), results, mode) : null

  // Scoring tallies — knockout counts come straight from the (mode-aware) breakdown
  // so they never drift from the points shown.
  const bd = (k: string) => score?.breakdown.find(r => r.key === k)
  const groupCorrect = bd('groups')?.correct ?? 0
  const thirdCorrect = bd('third')?.correct ?? 0
  const r32Correct  = bd('r32')?.correct ?? 0
  const r16Correct  = bd('r16')?.correct ?? 0
  const qfCorrect   = bd('qf')?.correct ?? 0
  const sfCorrect   = bd('sf')?.correct ?? 0
  const champCorrect = bd('final')?.correct ?? 0

  const firstIncompleteGroup: Tab = !groupsDone ? 'groups' : 'third'
  const groupSectionsDone = [groupsDone, thirdDone].filter(Boolean).length
  const firstIncomplete: Tab = !groupsDone ? 'groups' : !thirdDone ? 'third' : 'bracket'
  const completeSections = [groupsDone, thirdDone, knockoutDone].filter(Boolean).length
  const allComplete = groupPhaseDone && knockoutDone

  // Reusable card styles.
  const lockedInCard = (title: string) => (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 18px', borderRadius:16, background:'linear-gradient(135deg,color-mix(in srgb,var(--win) 14%,var(--surface)),color-mix(in srgb,var(--win) 5%,var(--surface)))', border:'1.5px solid color-mix(in srgb,var(--win) 38%,var(--line))' }}>
      <span style={{ width:32, height:32, borderRadius:'50%', background:'var(--win)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, flexShrink:0 }}>✓</span>
      <div>
        <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:17, color:'var(--ink)' }}>{title}</div>
        <div style={{ fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-2)', marginTop:1 }}>Saved automatically. You can still edit until <strong style={{ color:'var(--ink)' }}>{bracketLockLabel}</strong>.</div>
      </div>
    </div>
  )
  const completeCard = (title: string) => (
    <div style={{ padding:'18px', borderRadius:16, background:'linear-gradient(135deg,color-mix(in srgb,var(--accent) 12%,var(--surface)),color-mix(in srgb,var(--accent) 4%,var(--surface)))', border:'1.5px solid color-mix(in srgb,var(--accent) 32%,var(--line))', textAlign:'center' }}>
      <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:19, color:'var(--ink)', marginBottom:4 }}>{title}</div>
      <div style={{ fontFamily:'var(--f-body)', fontSize:13, color:'var(--ink-2)', marginBottom:14, maxWidth:340, marginInline:'auto' }}>All 31 picks are in. Lock it in to confirm — you can still tweak picks until {bracketLockLabel}.</div>
      <button onClick={onSubmit} className="btn-primary" style={{ padding:'12px 28px', fontSize:15, fontWeight:700 }}>✓ Lock in my bracket</button>
    </div>
  )
  const finishButton = (target: Tab, title: string, sub: string, badge: string) => (
    <button onClick={() => onGoTo(target)}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderRadius:16, background:'var(--surface)', border:'1px dashed color-mix(in srgb,var(--accent) 40%,var(--line))', cursor:'pointer', textAlign:'left', width:'100%' }}>
      <span style={{ width:32, height:32, borderRadius:'50%', background:'color-mix(in srgb,var(--accent) 14%,transparent)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0 }}>→</span>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:16, color:'var(--ink)' }}>{title}</div>
        <div style={{ fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-2)', marginTop:1 }}>{sub}</div>
      </div>
      <span style={{ fontFamily:'var(--f-mono)', fontSize:11, fontWeight:700, color:'var(--accent)' }}>{badge}</span>
    </button>
  )

  // Mode-aware "submit / completeness" affordance.
  const submitSection = (() => {
    if (bracketLocked) return null // read-only after this mode's lock

    // PICK'EM — fill the whole bracket up front; single lock.
    if (isPickem) {
      if (allComplete) {
        return submitted ? lockedInCard('Bracket locked in') : completeCard('🎉 Your bracket is complete')
      }
      return finishButton(firstIncomplete, 'Finish your bracket', `${completeSections} of 3 stages complete · groups, 3rd place, knockout`, `${completeSections}/3`)
    }

    // RESET — phased.
    if (bracketOpen) {
      if (!knockoutDone) {
        return finishButton('bracket', 'Finish your knockout bracket', `${bracketPicks} of 31 picks in · pick through to the final`, `${bracketPicks}/31`)
      }
      return submitted ? lockedInCard('Knockout bracket locked in') : completeCard('🎉 Your knockout bracket is complete')
    }
    if (!groupLocked) {
      return groupPhaseDone ? (
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 18px', borderRadius:16, background:'linear-gradient(135deg,color-mix(in srgb,var(--win) 14%,var(--surface)),color-mix(in srgb,var(--win) 5%,var(--surface)))', border:'1.5px solid color-mix(in srgb,var(--win) 38%,var(--line))' }}>
          <span style={{ width:32, height:32, borderRadius:'50%', background:'var(--win)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, flexShrink:0 }}>✓</span>
          <div>
            <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:17, color:'var(--ink)' }}>Group picks complete</div>
            <div style={{ fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-2)', marginTop:1 }}>Editable until <strong style={{ color:'var(--ink)' }}>{LOCK_LABEL}</strong>. Your knockout bracket opens after the group stage.</div>
          </div>
        </div>
      ) : finishButton(firstIncompleteGroup, 'Finish your group picks', '1st/2nd in all 12 groups + your 8 third-place qualifiers', `${groupSectionsDone}/2`)
    }
    // Between phases — group locked, knockout not yet open.
    return (
      <div style={{ padding:'14px 18px', borderRadius:16, background:'color-mix(in srgb,var(--gold) 9%,var(--surface))', border:'1px solid color-mix(in srgb,var(--gold) 28%,var(--line))' }}>
        <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:16, color:'var(--ink)' }}>🔒 Group picks locked</div>
        <div style={{ fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-2)', marginTop:2 }}>Your knockout bracket opens here once the group stage finishes.</div>
      </div>
    )
  })()

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {submitSection}

      {/* Points breakdown — once results start coming in */}
      {score && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', background:'linear-gradient(135deg,color-mix(in srgb,var(--accent) 10%,var(--surface)),var(--surface))', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--ink-3)', letterSpacing:'1px' }}>🏆 BRACKET POINTS</span>
            <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:26, color:'var(--accent)', lineHeight:1 }}>{score.points}<span style={{ fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-3)', fontWeight:700, marginLeft:4 }}>pts</span></span>
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {score.breakdown.filter(r => r.hasResults).map((r, i) => (
              <div key={r.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', borderTop:i>0?'1px solid var(--line)':'none' }}>
                <span style={{ flex:1, fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>{r.label}</span>
                <span style={{ fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-3)' }}>{r.correct}/{r.total}</span>
                <span style={{ width:62, textAlign:'right', fontFamily:'var(--f-mono)', fontSize:12, fontWeight:700, color: r.points>0 ? 'var(--win)' : 'var(--ink-3)' }}>{r.points>0?'+':''}{r.points} pts</span>
              </div>
            ))}
            {score.breakdown.every(r => !r.hasResults) && (
              <div style={{ padding:'14px 16px', fontFamily:'var(--f-body)', fontSize:12.5, color:'var(--ink-3)' }}>No results scored yet — points appear here as the tournament progresses.</div>
            )}
          </div>
        </div>
      )}

      {/* Status tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {[
          { label:'Groups',    done:groupsDone, value:groupsDone?undefined:`${doneCount}/12`, tab:'groups' as Tab },
          { label:'3rd Place', done:thirdDone,  value:thirdDone?undefined:`${state.tq.length}/8`, tab:'third' as Tab },
          { label:'Bracket',   done:!!state.final, value:`${bracketPicks}/31`, tab:'bracket' as Tab },
        ].map(({ label, done, value, tab }) => (
          <button key={label} onClick={() => onGoTo(tab)}
            style={{ padding:'14px 8px', background:done?'color-mix(in srgb,var(--win) 8%,var(--surface))':'var(--surface)', border:done?'1.5px solid color-mix(in srgb,var(--win) 25%,var(--line))':'1px solid var(--line)', borderRadius:14, cursor:'pointer', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:22, color:done?'var(--win)':'var(--ink-3)', marginBottom:4 }}>
              {value??(done?'✓':'—')}
            </div>
            <div style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Group picks — pick'em only. Reset re-seeds its knockout from the real R32,
          so its Summary focuses on the knockout; group/3rd points still count and
          are itemised in the Bracket Points card above. */}
      {isPickem && groupsDone && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--ink-3)', letterSpacing:'1px' }}>⚽ GROUP STAGE PICKS</span>
            {hasResults && <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--win)' }}>{groupCorrect}/24 correct</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)' }} className="sum-grid">
            {GROUP_KEYS.map((gk, i) => {
              const p = state.gp[gk] ?? {}
              const t1 = p.first ? teamByName(p.first) : null
              const t2 = p.second ? teamByName(p.second) : null
              const color = GC[gk]
              const actual = results?.group_results[gk]
              return (
                <div key={gk} style={{ padding:'10px 14px', borderTop:i>=2?'1px solid var(--line)':'none', borderLeft:i%2===1?'1px solid var(--line)':'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
                    <div style={{ width:18, height:18, borderRadius:5, background:color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:10, color:'#fff' }}>{gk}</span>
                    </div>
                    <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--ink-3)', letterSpacing:'0.5px' }}>GROUP {gk}</span>
                  </div>
                  {t1 && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ width:18, height:16, borderRadius:4, background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0 }}>1</span>
                      <span style={{ fontSize:14 }}>{t1.f}</span>
                      <span style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:12, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t1.n}</span>
                      <ResultBadge pick={p.first} actual={actual?.first} />
                    </div>
                  )}
                  {t2 && (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:18, height:16, borderRadius:4, background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, color:'var(--ink-3)', flexShrink:0 }}>2</span>
                      <span style={{ fontSize:14 }}>{t2.f}</span>
                      <span style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:12, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t2.n}</span>
                      <ResultBadge pick={p.second} actual={actual?.second} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3rd-place — pick'em only (see note above). */}
      {isPickem && state.tq.length>0 && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--ink-3)', letterSpacing:'1px' }}>🟢 3RD-PLACE QUALIFIERS</span>
            {hasResults && <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--win)' }}>{thirdCorrect}/8 correct</span>}
          </div>
          <div style={{ padding:'12px 16px', display:'flex', flexWrap:'wrap', gap:6 }}>
            {state.tq.map((nm, i) => {
              const t = teamByName(nm)
              const correct = results ? results.third_quals.includes(nm) : null
              return (
                <span key={nm} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20,
                  background: correct === true ? 'color-mix(in srgb,var(--win) 10%,transparent)' : correct === false ? 'color-mix(in srgb,var(--live) 8%,transparent)' : 'color-mix(in srgb,var(--win) 8%,transparent)',
                  border: `1px solid ${correct === true ? 'color-mix(in srgb,var(--win) 30%,var(--line))' : correct === false ? 'color-mix(in srgb,var(--live) 25%,var(--line))' : 'color-mix(in srgb,var(--win) 22%,var(--line))'}`,
                  fontFamily:'var(--f-body)', fontSize:12, fontWeight:600, color:'var(--ink)' }}>
                  <span style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--ink-3)' }}>#{i+1}</span>
                  {t.f} {nm}
                  {correct !== null && <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:800, color: correct ? 'var(--win)' : 'var(--live)' }}>{correct ? '✓' : '✗'}</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Knockout picks */}
      {bracketPicks>0 && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--ink-3)', letterSpacing:'1px' }}>🏟️ KNOCKOUT PICKS</span>
            {hasResults && <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--win)' }}>{r32Correct+r16Correct+qfCorrect+sfCorrect}/31 correct</span>}
          </div>
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { label: isPickem?'Round of 16':'Round of 32', picks:state.r32, actuals: results?.r32_results, correct: r32Correct, total: 16 },
              { label: isPickem?'Quarter-finals':'Round of 16', picks:state.r16, actuals: results?.r16_results, correct: r16Correct, total: 8 },
              { label: isPickem?'Semi-finals':'Quarterfinals', picks:state.qf, actuals: results?.qf_results, correct: qfCorrect, total: 4 },
              { label: isPickem?'Final':'Semifinals', picks:state.sf, actuals: results?.sf_results, correct: sfCorrect, total: 2 },
            ].map(({ label, picks, actuals, correct, total }) => {
              const made = picks.map((p, i) => ({ nm: p, i })).filter(x => x.nm)
              if (!made.length) return null
              return (
                <div key={label}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
                    <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--ink-3)', letterSpacing:'0.8px', textTransform:'uppercase' }}>{label}</span>
                    {hasResults && actuals?.some(Boolean) && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--win)' }}>{correct}/{total}</span>}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {made.map(({ nm, i }) => {
                      const t = teamByName(nm!)
                      const isCorrect = knockoutPickCorrect(nm!, i, actuals, isPickem)
                      return (
                        <span key={`${nm}-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:14,
                          background: isCorrect === true ? 'color-mix(in srgb,var(--win) 10%,var(--surface-2))' : isCorrect === false ? 'color-mix(in srgb,var(--live) 8%,var(--surface-2))' : 'var(--surface-2)',
                          border: `1px solid ${isCorrect === true ? 'color-mix(in srgb,var(--win) 30%,var(--line))' : isCorrect === false ? 'color-mix(in srgb,var(--live) 25%,var(--line))' : 'var(--line)'}`,
                          fontFamily:'var(--f-body)', fontSize:12, fontWeight:600, color:'var(--ink)' }}>
                          {t.f} {nm}
                          {isCorrect !== null && <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:800, color: isCorrect ? 'var(--win)' : 'var(--live)' }}>{isCorrect ? '✓' : '✗'}</span>}
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

      {/* Champion */}
      {state.final && (() => {
        const isCorrect = results?.final_result ? state.final === results.final_result : null
        return (
          <div style={{ padding:'28px 20px',
            background: isCorrect === true ? 'linear-gradient(135deg,color-mix(in srgb,var(--win) 18%,var(--surface)),color-mix(in srgb,var(--win) 6%,var(--surface)))' : 'linear-gradient(135deg,color-mix(in srgb,var(--gold) 14%,var(--surface)),color-mix(in srgb,var(--gold) 5%,var(--surface)))',
            border: `1.5px solid ${isCorrect === true ? 'color-mix(in srgb,var(--win) 40%,var(--line))' : 'color-mix(in srgb,var(--gold) 35%,var(--line))'}`,
            borderRadius:20, textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:10 }}>{teamByName(state.final).f}</div>
            {isCorrect === true && <div style={{ fontFamily:'var(--f-mono)', fontSize:11, fontWeight:800, color:'var(--win)', letterSpacing:'1.5px', marginBottom:6 }}>🏆 CORRECT · +{BRACKET_PTS.champion} PTS</div>}
            {isCorrect === false && results?.final_result && (
              <div style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--live)', fontWeight:700, marginBottom:6 }}>
                ✗ Winner was {teamByName(results.final_result).f} {results.final_result}
              </div>
            )}
            <div style={{ fontFamily:'var(--f-mono)', fontSize:10, letterSpacing:'2px', color: isCorrect === true ? 'var(--win)' : 'var(--gold)', fontWeight:700, marginBottom:4 }}>YOUR TOURNAMENT CHAMPION</div>
            <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:28, color:'var(--ink)' }}>{state.final}</div>
          </div>
        )
      })()}

      <style>{`@media(min-width:600px){.sum-grid{grid-template-columns:repeat(3,1fr)!important}}@media(min-width:900px){.sum-grid{grid-template-columns:repeat(4,1fr)!important}}`}</style>
    </div>
  )
}

// ── STANDINGS TAB ──────────────────────────────────────────────────────────────

function StandingsTab({ results }: { results: TournamentResults | null }) {
  if (!results || !Object.keys(results.group_results ?? {}).length) {
    return (
      <div style={{ padding:'48px 24px', textAlign:'center', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:20 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
        <div style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:20, color:'var(--ink)' }}>No Results Yet</div>
        <p style={{ fontFamily:'var(--f-body)', fontSize:14, color:'var(--ink-2)', marginTop:8 }}>
          Group standings will appear here once the group stage is complete.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontFamily:'var(--f-body)', fontSize:12, color:'var(--ink-3)', marginBottom:16 }}>
        Final group stage standings. Top 2 advance automatically; best 8 third-place teams also advance.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }} className="bc-grid">
        {GROUP_KEYS.map(gk => {
          const res = results.group_results[gk]
          if (!res?.first) return null
          const color = GC[gk]
          const grpTeams = GROUPS[gk].teams
          const fourth = grpTeams.find(tm => tm.n !== res.first && tm.n !== res.second && tm.n !== res.third)

          const standings = [
            { pos: 1, name: res.first,   adv: 'R32' as const },
            { pos: 2, name: res.second,  adv: 'R32' as const },
            { pos: 3, name: res.third,   adv: (results.third_quals.includes(res.third) ? 'ADV' : null) as 'ADV' | null },
            { pos: 4, name: fourth?.n ?? '', adv: null },
          ]

          return (
            <div key={gk} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:color }}>
                <span style={{ fontFamily:'var(--f-cond)', fontWeight:800, fontSize:15, color:'#fff' }}>Group {gk}</span>
              </div>
              {standings.map(({ pos, name, adv }, idx) => {
                if (!name) return null
                const t = teamByName(name)
                const isElim = !adv
                const posLabels = ['', '1ST', '2ND', '3RD', '4TH']
                const posBg   = pos===1 ? 'var(--gold)' : pos===2 ? '#888' : pos===3 ? '#b87333' : 'var(--surface-2)'
                const posClr  = pos<=3 ? '#fff' : 'var(--ink-3)'
                return (
                  <div key={pos} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderTop:idx>0?'1px solid var(--line)':'none', opacity:isElim?0.52:1, background:adv==='R32'?'color-mix(in srgb,var(--win) 4%,var(--surface))':adv==='ADV'?'color-mix(in srgb,var(--accent) 4%,var(--surface))':'var(--surface)' }}>
                    <span style={{ width:28, height:20, borderRadius:5, background:posBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:'var(--f-mono)', fontWeight:700, fontSize:9, color:posClr }}>
                      {posLabels[pos]}
                    </span>
                    <Flag iso={isoForTeam(t.c)} size={20} radius={5} ring={false} alt={t.n} />
                    <span style={{ flex:1, fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, color:isElim?'var(--ink-3)':'var(--ink)' }}>{name}</span>
                    {adv === 'R32' && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--win)', flexShrink:0 }}>R32 ✓</span>}
                    {adv === 'ADV' && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>ADV ✓</span>}
                    {isElim        && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--ink-3)', flexShrink:0 }}>OUT</span>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <style>{`@media(min-width:600px){.bc-grid{grid-template-columns:repeat(2,1fr)!important}}@media(min-width:960px){.bc-grid{grid-template-columns:repeat(3,1fr)!important}}`}</style>
    </div>
  )
}
