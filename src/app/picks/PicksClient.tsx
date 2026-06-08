'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import MatchCard, { type PickPayload } from '@/components/MatchCard'
import { isMatchLocked } from '@/lib/utils'
import { getMatchResult } from '@/lib/scoring'
import type { MatchWithPick, Pick } from '@/lib/types'

type FilterMode = 'results' | 'upcoming' | 'live' | 'all'

interface Props {
  userId: string
  initialMatches: MatchWithPick[]
}

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KNOCKOUT_STAGES = [
  { stage: 'R32',   label: 'Round of 32' },
  { stage: 'R16',   label: 'Round of 16' },
  { stage: 'QF',    label: 'Quarterfinals' },
  { stage: 'SF',    label: 'Semifinals' },
  { stage: 'THIRD', label: 'Third Place' },
  { stage: 'FINAL', label: 'Final' },
]
const GROUP_COLORS: Record<string, string> = {
  A: '#2f6fe0', B: '#1f9d5a', C: '#e03c2c', D: '#c98a1a',
  E: '#7c3aed', F: '#0891b2', G: '#db2777', H: '#059669',
  I: '#d97706', J: '#4f46e5', K: '#dc2626', L: '#0d9488',
}

const isCorrect = (r: string | null | undefined) => r === 'CORRECT' || r === 'EXACT'

export default function PicksClient({ userId, initialMatches }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [matches, setMatches] = useState(initialMatches)
  // Default to Results if any picks are already scored; otherwise Upcoming
  const hasScored = initialMatches.some(m => !!m.userPick?.pick_result)
  const [filter, setFilter] = useState<FilterMode>(hasScored ? 'results' : 'upcoming')

  // Real-time: live score + status updates for any match (test case: live score within 5s)
  useEffect(() => {
    const channel = supabase
      .channel('picks-live-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        payload => {
          const n = payload.new as Partial<MatchWithPick> & { id: string }
          setMatches(prev =>
            prev.map(m =>
              m.id === n.id
                ? { ...m, home_score: n.home_score ?? m.home_score, away_score: n.away_score ?? m.away_score, status: n.status ?? m.status }
                : m
            )
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  async function handlePickSaved(matchId: string, { home, away }: PickPayload) {
    const winner = getMatchResult(home, away)
    const { error } = await supabase.from('picks').upsert(
      {
        user_id: userId,
        match_id: matchId,
        home_score_pick: home,
        away_score_pick: away,
        winner_pick: winner,
      },
      { onConflict: 'user_id,match_id' }
    )
    if (error) throw error

    setMatches(prev =>
      prev.map(m =>
        m.id === matchId
          ? {
              ...m,
              userPick: {
                id: m.userPick?.id ?? '',
                user_id: userId,
                match_id: matchId,
                home_score_pick: home,
                away_score_pick: away,
                confidence_multiplier: 1,
                winner_pick: winner,
                points_earned: m.userPick?.points_earned ?? null,
                pick_result: m.userPick?.pick_result ?? null,
                scored_at: m.userPick?.scored_at ?? null,
                created_at: m.userPick?.created_at ?? new Date().toISOString(),
              } as Pick,
            }
          : m
      )
    )
  }

  const filtered = matches.filter(m => {
    if (filter === 'results')  return m.status === 'FINISHED' && !!m.userPick?.pick_result
    if (filter === 'upcoming') return !isMatchLocked(m.kickoff_time)
    if (filter === 'live')     return m.status === 'LIVE'
    return true
  })

  type Section = {
    key: string; label: string; sublabel?: string
    color?: string; matches: MatchWithPick[]
    isGroup: boolean; groupLetter?: string
  }

  const sectionSublabel = (list: MatchWithPick[]) => {
    const picked  = list.filter(m => !!m.userPick).length
    const correct = list.filter(m => isCorrect(m.userPick?.pick_result)).length
    const scored  = list.filter(m => !!m.userPick?.pick_result).length
    return filter === 'results' ? `${correct}/${scored} correct` : `${picked}/${list.length} picked`
  }

  const sections: Section[] = []
  for (const gl of GROUP_LETTERS) {
    const gMatches = filtered.filter(m => m.stage === 'GROUP' && m.group_letter === gl)
    if (gMatches.length > 0) {
      sections.push({
        key: `group-${gl}`, label: `Group ${gl}`,
        sublabel: sectionSublabel(gMatches), color: GROUP_COLORS[gl], matches: gMatches,
        isGroup: true, groupLetter: gl,
      })
    }
  }
  for (const { stage, label } of KNOCKOUT_STAGES) {
    const kMatches = filtered.filter(m => m.stage === stage)
    if (kMatches.length > 0) {
      sections.push({ key: stage, label, sublabel: sectionSublabel(kMatches), matches: kMatches, isGroup: false })
    }
  }

  const upcomingCount = matches.filter(m => !isMatchLocked(m.kickoff_time)).length
  const liveCount     = matches.filter(m => m.status === 'LIVE').length
  const pickedCount   = matches.filter(m => !!m.userPick).length
  const scoredCount   = matches.filter(m => !!m.userPick?.pick_result).length
  const correctCount  = matches.filter(m => isCorrect(m.userPick?.pick_result)).length

  const filterOpts: { key: FilterMode; label: string }[] = [
    ...(scoredCount > 0 ? [{ key: 'results' as FilterMode, label: `Results (${correctCount}/${scoredCount})` }] : []),
    { key: 'upcoming', label: `Upcoming (${upcomingCount})` },
    { key: 'live',     label: liveCount > 0 ? `Live (${liveCount})` : 'Live' },
    { key: 'all',      label: 'All' },
  ]

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3, padding: 3,
        borderRadius: 12, background: 'var(--surface-2)', margin: '16px 20px 22px',
      }}>
        {filterOpts.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              flex: 1, border: 'none', cursor: 'pointer',
              padding: '8px 6px', borderRadius: 9,
              background: filter === key ? 'var(--surface)' : 'transparent',
              boxShadow: filter === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              fontFamily: 'var(--f-body)', fontWeight: filter === key ? 700 : 500,
              fontSize: 13, color: filter === key ? 'var(--ink)' : 'var(--ink-3)',
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', paddingRight: 6, flexShrink: 0 }}>
          {pickedCount}/{matches.length}
        </span>
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <div style={{
          margin: '0 20px', padding: '40px 24px', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚽</div>
          <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 18, color: 'var(--ink-2)' }}>No matches here</div>
          <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Try a different filter</div>
        </div>
      )}

      {/* Sections */}
      {sections.map(section => {
        const total = section.matches.length
        const picked = section.matches.filter(m => !!m.userPick).length
        const pct = total > 0 ? (picked / total) * 100 : 0
        const allDone = picked === total && total > 0

        return (
          <div key={section.key} style={{ marginBottom: 32 }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', marginBottom: 12 }}>
              {section.isGroup && section.groupLetter ? (
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: section.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, boxShadow: `0 4px 10px -3px ${section.color}88`,
                }}>
                  <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 17, color: '#fff', lineHeight: 1 }}>
                    {section.groupLetter}
                  </span>
                </div>
              ) : (
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: 'var(--navy)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                    <path d="M3 5h5v6h4M3 19h5v-6M21 12h-4m4-7h-5v6m5 8h-5v-6" />
                  </svg>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 17, color: 'var(--ink)', lineHeight: 1.1 }}>
                  {section.label}
                </div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: allDone ? 'var(--win)' : filter === 'results' ? 'var(--win)' : 'var(--ink-3)', marginTop: 3, letterSpacing: '0.5px' }}>
                  {allDone && filter !== 'results' ? '✓ Complete' : section.sublabel}
                </div>
              </div>
              {section.isGroup && (
                <div style={{ width: 48, height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 3,
                    background: allDone ? 'var(--win)' : section.color, transition: 'width .3s',
                  }} />
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ margin: '0 20px 12px', height: 1, background: 'var(--line)', opacity: 0.6 }} />

            {/* Match cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1,1fr)', gap: 10, padding: '0 20px' }} className="picks-match-grid">
              {section.matches.map(match => (
                <MatchCard key={match.id} match={match} onPickSaved={handlePickSaved} />
              ))}
            </div>
          </div>
        )
      })}

      <style>{`
        @media (min-width:600px)  { .picks-match-grid { grid-template-columns:repeat(2,1fr) !important; } }
        @media (min-width:1100px) { .picks-match-grid { grid-template-columns:repeat(3,1fr) !important; } }
      `}</style>
    </div>
  )
}
