import { describe, it, expect } from 'vitest'
import { getMatchResult, scorePick, previewPickPoints, summarizePicks } from './scoring'

describe('getMatchResult', () => {
  it('detects home win, away win, and draw', () => {
    expect(getMatchResult(2, 1)).toBe('HOME')
    expect(getMatchResult(0, 3)).toBe('AWAY')
    expect(getMatchResult(1, 1)).toBe('DRAW')
  })
})

describe('scorePick (GDD §2.1: 0 / 3 / 5 × confidence)', () => {
  const match = { home_score: 2, away_score: 1 } // HOME win

  it('exact score = 5 × multiplier', () => {
    expect(scorePick({ home_score_pick: 2, away_score_pick: 1, confidence_multiplier: 1 }, match))
      .toEqual({ points: 5, result: 'EXACT' })
    expect(scorePick({ home_score_pick: 2, away_score_pick: 1, confidence_multiplier: 3 }, match))
      .toEqual({ points: 15, result: 'EXACT' })
  })

  it('correct outcome but wrong score = 3 × multiplier', () => {
    expect(scorePick({ home_score_pick: 3, away_score_pick: 0, confidence_multiplier: 1 }, match))
      .toEqual({ points: 3, result: 'CORRECT' })
    expect(scorePick({ home_score_pick: 1, away_score_pick: 0, confidence_multiplier: 2 }, match))
      .toEqual({ points: 6, result: 'CORRECT' })
  })

  it('wrong outcome = 0 regardless of multiplier', () => {
    expect(scorePick({ home_score_pick: 0, away_score_pick: 2, confidence_multiplier: 3 }, match))
      .toEqual({ points: 0, result: 'WRONG' })
  })

  it('handles draws (exact vs correct-outcome)', () => {
    const draw = { home_score: 1, away_score: 1 }
    expect(scorePick({ home_score_pick: 1, away_score_pick: 1, confidence_multiplier: 1 }, draw))
      .toEqual({ points: 5, result: 'EXACT' })
    expect(scorePick({ home_score_pick: 2, away_score_pick: 2, confidence_multiplier: 1 }, draw))
      .toEqual({ points: 3, result: 'CORRECT' })
  })
})

describe('previewPickPoints', () => {
  it('scales both tiers by the multiplier', () => {
    expect(previewPickPoints(1, 0, 1)).toEqual({ correctPts: 3, exactPts: 5 })
    expect(previewPickPoints(1, 0, 2)).toEqual({ correctPts: 6, exactPts: 10 })
    expect(previewPickPoints(1, 0, 3)).toEqual({ correctPts: 9, exactPts: 15 })
  })
})

describe('summarizePicks', () => {
  it('aggregates total / exact / correct / scored, ignoring unscored', () => {
    expect(summarizePicks([
      { points_earned: 5, pick_result: 'EXACT' },
      { points_earned: 3, pick_result: 'CORRECT' },
      { points_earned: 0, pick_result: 'WRONG' },
      { points_earned: null, pick_result: null },
    ])).toEqual({ total: 8, exact: 1, correct: 2, scored: 3 })
  })

  it('counts EXACT as also correct', () => {
    expect(summarizePicks([
      { points_earned: 15, pick_result: 'EXACT' },
      { points_earned: 5, pick_result: 'EXACT' },
    ])).toEqual({ total: 20, exact: 2, correct: 2, scored: 2 })
  })
})
