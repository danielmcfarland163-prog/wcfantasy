import { describe, it, expect } from 'vitest'
import { getMatchResult, scorePick, scoreAllPicksForMatch, previewPickPoints, summarizePicks } from './scoring'

describe('getMatchResult', () => {
  it('detects home win, away win, and draw', () => {
    expect(getMatchResult(2, 1)).toBe('HOME')
    expect(getMatchResult(0, 3)).toBe('AWAY')
    expect(getMatchResult(1, 1)).toBe('DRAW')
  })
})

describe('scorePick (GDD §2.1: 0 / 3 / 5, no multiplier)', () => {
  const match = { home_score: 2, away_score: 1 } // HOME win

  it('exact score = 5', () => {
    expect(scorePick({ home_score_pick: 2, away_score_pick: 1 }, match))
      .toEqual({ points: 5, result: 'EXACT' })
  })

  it('correct outcome but wrong score = 3', () => {
    expect(scorePick({ home_score_pick: 3, away_score_pick: 0 }, match))
      .toEqual({ points: 3, result: 'CORRECT' })
    expect(scorePick({ home_score_pick: 1, away_score_pick: 0 }, match))
      .toEqual({ points: 3, result: 'CORRECT' })
  })

  it('wrong outcome = 0', () => {
    expect(scorePick({ home_score_pick: 0, away_score_pick: 2 }, match))
      .toEqual({ points: 0, result: 'WRONG' })
  })

  it('handles draws (exact vs correct-outcome)', () => {
    const draw = { home_score: 1, away_score: 1 }
    expect(scorePick({ home_score_pick: 1, away_score_pick: 1 }, draw))
      .toEqual({ points: 5, result: 'EXACT' })
    expect(scorePick({ home_score_pick: 2, away_score_pick: 2 }, draw))
      .toEqual({ points: 3, result: 'CORRECT' })
  })
})

describe('previewPickPoints', () => {
  it('returns the flat correct / exact tiers', () => {
    expect(previewPickPoints(1, 0)).toEqual({ correctPts: 3, exactPts: 5 })
    expect(previewPickPoints(3, 2)).toEqual({ correctPts: 3, exactPts: 5 })
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

describe('scoreAllPicksForMatch', () => {
  it('scores a batch of picks against one match result (flat 0/3/5)', () => {
    const res = scoreAllPicksForMatch(
      [
        { home_score_pick: 2, away_score_pick: 1 }, // EXACT → 5
        { home_score_pick: 0, away_score_pick: 0 }, // predicted DRAW, actual HOME → 0
        { home_score_pick: 5, away_score_pick: 0 }, // HOME outcome, wrong score → 3
      ],
      { home_score: 2, away_score: 1 },
    )
    expect(res.map(r => r.points)).toEqual([5, 0, 3])
    expect(res.map(r => r.result)).toEqual(['EXACT', 'WRONG', 'CORRECT'])
  })
})
