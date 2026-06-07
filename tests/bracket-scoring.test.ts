import { describe, it, expect } from 'vitest'
import {
  scoreBracketEntry,
  BRACKET_PTS,
  BRACKET_TOTALS,
  BRACKET_MAX_POINTS,
} from '../src/lib/bracket-scoring'

describe('bracket scoring constants (GDD §2.2)', () => {
  it('uses the spec point values', () => {
    expect(BRACKET_PTS).toEqual({
      group1st: 2,
      group2nd: 2,
      third: 2,
      r32: 3,
      r16: 5,
      qf: 8,
      sf: 13,
      champion: 21,
    })
  })

  it('theoretical max is 231 and equals the sum of section maxima', () => {
    const computed =
      BRACKET_TOTALS.group1st * BRACKET_PTS.group1st +
      BRACKET_TOTALS.group2nd * BRACKET_PTS.group2nd +
      BRACKET_TOTALS.third * BRACKET_PTS.third +
      BRACKET_TOTALS.r32 * BRACKET_PTS.r32 +
      BRACKET_TOTALS.r16 * BRACKET_PTS.r16 +
      BRACKET_TOTALS.qf * BRACKET_PTS.qf +
      BRACKET_TOTALS.sf * BRACKET_PTS.sf +
      BRACKET_TOTALS.final * BRACKET_PTS.champion
    expect(computed).toBe(231)
    expect(BRACKET_MAX_POINTS).toBe(231)
  })
})

describe('scoreBracketEntry', () => {
  it('awards 2 + 2 for a correct group 1st and 2nd', () => {
    const s = scoreBracketEntry(
      { group_picks: { A: { first: 'BRA', second: 'ARG' } } },
      { group_results: { A: { first: 'BRA', second: 'ARG' } } },
    )
    expect(s.points).toBe(4)
    expect(s.correct).toBe(2)
  })

  it('does not penalize rounds that have no results yet', () => {
    const s = scoreBracketEntry(
      { group_picks: { A: { first: 'BRA', second: 'ARG' } }, final_pick: 'BRA' },
      { group_results: { A: { first: 'BRA', second: 'GER' } } }, // only 1st correct, no final result
    )
    expect(s.points).toBe(2)
    expect(s.championCorrect).toBe(0)
  })

  it('scores knockout rounds positionally and the champion at 21', () => {
    const s = scoreBracketEntry(
      { r32_picks: ['BRA', 'ARG'], r16_picks: ['BRA'], final_pick: 'BRA' },
      {
        r32_results: ['BRA', 'GER'], // 1 of 2 correct → 3
        r16_results: ['BRA'], // 1 correct → 5
        final_result: 'BRA', // champion → 21
      },
    )
    expect(s.points).toBe(3 + 5 + 21)
    expect(s.championCorrect).toBe(1)
  })

  it('counts picksMade for completeness independent of results', () => {
    const s = scoreBracketEntry(
      {
        group_picks: { A: { first: 'BRA', second: 'ARG' } },
        third_quals: ['CRO'],
        r32_picks: ['BRA'],
        final_pick: 'BRA',
      },
      null,
    )
    // 2 (group first+second) + 1 (third) + 1 (r32) + 1 (final) = 5
    expect(s.picksMade).toBe(5)
    expect(s.points).toBe(0)
  })
})
