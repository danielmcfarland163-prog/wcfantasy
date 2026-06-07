import { describe, it, expect } from 'vitest'
import { scoreBracketEntry, BRACKET_PTS, BRACKET_MAX_POINTS } from './bracket-scoring'

describe('BRACKET_PTS (GDD §2.2 single source of truth)', () => {
  it('uses the spec point values', () => {
    expect(BRACKET_PTS).toEqual({
      group1st: 2, group2nd: 2, third: 2, r32: 3, r16: 5, qf: 8, sf: 13, champion: 21,
    })
  })
  it('theoretical maximum is 231', () => {
    expect(BRACKET_MAX_POINTS).toBe(231)
  })
})

describe('scoreBracketEntry', () => {
  it('awards 0 with no penalty when results are empty', () => {
    const r = scoreBracketEntry({ group_picks: { A: { first: 'X', second: 'Y' } } }, {})
    expect(r.points).toBe(0)
    expect(r.correct).toBe(0)
  })

  it('scores group 1st + 2nd independently (2 pts each)', () => {
    const both = scoreBracketEntry(
      { group_picks: { A: { first: 'BRA', second: 'SRB' } } },
      { group_results: { A: { first: 'BRA', second: 'SRB', third: 'CMR' } } },
    )
    expect(both.points).toBe(4)
    expect(both.correct).toBe(2)

    const firstOnly = scoreBracketEntry(
      { group_picks: { A: { first: 'BRA', second: 'ZZZ' } } },
      { group_results: { A: { first: 'BRA', second: 'SRB' } } },
    )
    expect(firstOnly.points).toBe(2)
  })

  it('scores 3rd-place qualifiers by membership (order-independent)', () => {
    const r = scoreBracketEntry({ third_quals: ['A', 'B', 'C'] }, { third_quals: ['C', 'A', 'X'] })
    expect(r.points).toBe(4) // A and C correct → 2 × 2
  })

  it('scores knockout rounds by bracket position', () => {
    const r = scoreBracketEntry(
      { r32_picks: ['A', 'B'], r16_picks: ['A'], qf_picks: ['A'], sf_picks: ['A'] },
      { r32_results: ['A', 'Z'], r16_results: ['A'], qf_results: ['A'], sf_results: ['A'] },
    )
    // r32: 1×3 + r16: 1×5 + qf: 1×8 + sf: 1×13 = 29
    expect(r.points).toBe(29)
  })

  it('awards 21 for the champion (final) pick', () => {
    const r = scoreBracketEntry({ final_pick: 'ARG' }, { final_result: 'ARG' })
    expect(r.points).toBe(21)
    expect(r.championCorrect).toBe(1)
  })

  it('flags which sections have results (partial tournament)', () => {
    const r = scoreBracketEntry({ r32_picks: ['A', 'B'] }, { r32_results: ['A', 'B'] })
    expect(r.points).toBe(6)
    expect(r.breakdown.find(b => b.key === 'r32')?.hasResults).toBe(true)
    expect(r.breakdown.find(b => b.key === 'final')?.hasResults).toBe(false)
  })

  it('a perfect bracket scores exactly BRACKET_MAX_POINTS', () => {
    const L = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    const group_picks: Record<string, { first: string; second: string }> = {}
    const group_results: Record<string, { first: string; second: string; third: string }> = {}
    L.forEach(g => {
      group_picks[g] = { first: `1${g}`, second: `2${g}` }
      group_results[g] = { first: `1${g}`, second: `2${g}`, third: `3${g}` }
    })
    const third = L.slice(0, 8).map(g => `3${g}`)
    const mk = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`)
    const r32 = mk(16, 'r32_'), r16 = mk(8, 'r16_'), qf = mk(4, 'qf_'), sf = mk(2, 'sf_')

    const entry = { group_picks, third_quals: third, r32_picks: r32, r16_picks: r16, qf_picks: qf, sf_picks: sf, final_pick: 'CH' }
    const results = { group_results, third_quals: third, r32_results: r32, r16_results: r16, qf_results: qf, sf_results: sf, final_result: 'CH' }

    expect(scoreBracketEntry(entry, results).points).toBe(BRACKET_MAX_POINTS)
  })
})
