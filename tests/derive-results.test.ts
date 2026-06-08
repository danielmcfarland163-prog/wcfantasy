import { describe, it, expect } from 'vitest'
import { computeTournamentResults, type DeriveMatch } from '../src/lib/derive-results'

// Build a fully deterministic tournament: 12 groups of 4 ("A1".."L4"), a full
// round-robin where the higher seed always wins (so standings are 1>2>3>4), then
// knockout matches where the HOME team (first listed) always advances. Every
// expected result is therefore hand-computable, which lets us assert the whole
// derivation — group standings, best-8 thirds, and the R32→Final walk — exactly.

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const team = (name: string) => ({ id: name, name, short_code: name })

function groupMatches(): DeriveMatch[] {
  const out: DeriveMatch[] = []
  for (const g of GROUPS) {
    const t = [1, 2, 3, 4].map((n) => `${g}${n}`)
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        // Higher seed (lower index) wins 1-0.
        out.push({
          stage: 'GROUP', group_letter: g, status: 'FINISHED',
          home_score: 1, away_score: 0,
          home_team: team(t[i]), away_team: team(t[j]), winner_name: null,
        })
      }
    }
  }
  return out
}

function ko(stage: string, pairs: [string, string][]): DeriveMatch[] {
  return pairs.map(([h, a]) => ({
    stage, group_letter: null, status: 'FINISHED',
    home_score: 1, away_score: 0,
    home_team: team(h), away_team: team(a), winner_name: h, // home always advances
  }))
}

describe('computeTournamentResults — full deterministic tournament', () => {
  // Expected qualifiers
  const r32Pairs: [string, string][] = [
    ['A1', 'B2'], ['B1', 'A2'], ['C1', 'D2'], ['D1', 'C2'],
    ['E1', 'F2'], ['F1', 'E2'], ['G1', 'H2'], ['H1', 'G2'],
    ['I1', 'J2'], ['J1', 'I2'], ['K1', 'L2'], ['L1', 'K2'],
    ['A3', 'H3'], ['B3', 'G3'], ['C3', 'F3'], ['D3', 'E3'],
  ]
  const r32Winners = r32Pairs.map(([h]) => h)
  const r16Pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15]]
    .map(([i, j]) => [r32Winners[i], r32Winners[j]] as [string, string])
  const r16Winners = r16Pairs.map(([h]) => h)
  const qfPairs = [[0, 1], [2, 3], [4, 5], [6, 7]].map(([i, j]) => [r16Winners[i], r16Winners[j]] as [string, string])
  const qfWinners = qfPairs.map(([h]) => h)
  const sfPairs = [[0, 1], [2, 3]].map(([i, j]) => [qfWinners[i], qfWinners[j]] as [string, string])
  const sfWinners = sfPairs.map(([h]) => h)
  const finalPairs = [[sfWinners[0], sfWinners[1]]] as [string, string][]

  const all = [
    ...groupMatches(),
    ...ko('R32', r32Pairs), ...ko('R16', r16Pairs), ...ko('QF', qfPairs),
    ...ko('SF', sfPairs), ...ko('FINAL', finalPairs),
  ]
  const res = computeTournamentResults(all)

  it('derives group winners/runners-up/thirds', () => {
    expect(res.group_results.A).toEqual({ first: 'A1', second: 'A2', third: 'A3' })
    expect(res.group_results.L).toEqual({ first: 'L1', second: 'L2', third: 'L3' })
  })

  it('selects the best 8 third-placed teams (all tied → alphabetical A3..H3)', () => {
    expect(res.third_quals).toEqual(['A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3'])
  })

  it('walks the bracket from real winners to a champion', () => {
    expect(res.r32_results).toEqual(r32Winners)
    expect(res.r16_results).toEqual(r16Winners)
    expect(res.qf_results).toEqual(qfWinners)
    expect(res.sf_results).toEqual(sfWinners)
    expect(res.final_result).toBe('A1')
  })

  it('leaves later rounds null when knockout results are absent', () => {
    const groupsOnly = computeTournamentResults(groupMatches())
    expect(groupsOnly.group_results.A.first).toBe('A1')
    expect(groupsOnly.r32_results).toEqual(Array(16).fill(null))
    expect(groupsOnly.final_result).toBeNull()
  })
})
