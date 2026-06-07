import { describe, it, expect } from 'vitest'
import {
  getMatchResult,
  scorePick,
  scoreAllPicksForMatch,
  previewPickPoints,
  summarizePicks,
} from '../src/lib/scoring'

describe('getMatchResult', () => {
  it('classifies home win / draw / away win', () => {
    expect(getMatchResult(2, 1)).toBe('HOME')
    expect(getMatchResult(1, 1)).toBe('DRAW')
    expect(getMatchResult(0, 2)).toBe('AWAY')
  })
})

describe('scorePick (GDD §2.1: 0 / 3 / 5 × confidence)', () => {
  const actual = { home_score: 2, away_score: 1 } // HOME win

  it('awards 5 for an exact score (3 + 2 bonus) at 1×', () => {
    const r = scorePick({ home_score_pick: 2, away_score_pick: 1, confidence_multiplier: 1 }, actual)
    expect(r).toEqual({ points: 5, result: 'EXACT' })
  })

  it('multiplies an exact score by confidence (2× → 10, 3× → 15)', () => {
    expect(scorePick({ home_score_pick: 2, away_score_pick: 1, confidence_multiplier: 2 }, actual).points).toBe(10)
    expect(scorePick({ home_score_pick: 2, away_score_pick: 1, confidence_multiplier: 3 }, actual).points).toBe(15)
  })

  it('awards 3 for the correct outcome with a wrong scoreline at 1×', () => {
    const r = scorePick({ home_score_pick: 1, away_score_pick: 0, confidence_multiplier: 1 }, actual)
    expect(r).toEqual({ points: 3, result: 'CORRECT' })
  })

  it('multiplies a correct outcome by confidence (2× → 6)', () => {
    expect(scorePick({ home_score_pick: 3, away_score_pick: 0, confidence_multiplier: 2 }, actual).points).toBe(6)
  })

  it('awards 0 for the wrong outcome regardless of confidence', () => {
    const r = scorePick({ home_score_pick: 0, away_score_pick: 1, confidence_multiplier: 3 }, actual)
    expect(r).toEqual({ points: 0, result: 'WRONG' })
  })

  it('treats an exact draw as EXACT, not merely CORRECT', () => {
    const r = scorePick(
      { home_score_pick: 1, away_score_pick: 1, confidence_multiplier: 1 },
      { home_score: 1, away_score: 1 },
    )
    expect(r).toEqual({ points: 5, result: 'EXACT' })
  })
})

describe('previewPickPoints', () => {
  it('returns correct/exact previews scaled by the multiplier', () => {
    expect(previewPickPoints(2, 1, 1)).toEqual({ correctPts: 3, exactPts: 5 })
    expect(previewPickPoints(2, 1, 3)).toEqual({ correctPts: 9, exactPts: 15 })
  })
})

describe('summarizePicks', () => {
  it('aggregates total, exact, correct (incl. exact) and scored counts', () => {
    const s = summarizePicks([
      { points_earned: 5, pick_result: 'EXACT' },
      { points_earned: 3, pick_result: 'CORRECT' },
      { points_earned: 0, pick_result: 'WRONG' },
      { points_earned: null, pick_result: null }, // unscored
    ])
    expect(s).toEqual({ total: 8, exact: 1, correct: 2, scored: 3 })
  })
})

describe('scoreAllPicksForMatch', () => {
  it('scores a batch of picks against one match result', () => {
    const res = scoreAllPicksForMatch(
      [
        { home_score_pick: 2, away_score_pick: 1, confidence_multiplier: 1 }, // EXACT → 5
        { home_score_pick: 0, away_score_pick: 0, confidence_multiplier: 2 }, // DRAW vs HOME → 0
      ],
      { home_score: 2, away_score: 1 },
    )
    expect(res.map(r => r.points)).toEqual([5, 0])
    expect(res.map(r => r.result)).toEqual(['EXACT', 'WRONG'])
  })
})
