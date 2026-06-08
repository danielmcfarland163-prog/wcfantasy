// =============================================
// SCORING ENGINE
// =============================================
// Pure functions — no DB calls, fully testable

import type { Pick, Match, ScoringConfig } from './types'

const DEFAULT_CONFIG: ScoringConfig = {
  correct_result_pts: 3,
  exact_score_bonus: 2,    // on top of correct_result_pts = 5 total
}

export type MatchResult = 'HOME' | 'DRAW' | 'AWAY'

export function getMatchResult(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) return 'HOME'
  if (homeScore < awayScore) return 'AWAY'
  return 'DRAW'
}

export function scorePick(
  pick: { home_score_pick: number; away_score_pick: number; confidence_multiplier: number },
  match: { home_score: number; away_score: number },
  config: ScoringConfig = DEFAULT_CONFIG
): { points: number; result: 'EXACT' | 'CORRECT' | 'WRONG' } {
  const actualResult = getMatchResult(match.home_score, match.away_score)
  const pickedResult = getMatchResult(pick.home_score_pick, pick.away_score_pick)

  const isExact =
    pick.home_score_pick === match.home_score &&
    pick.away_score_pick === match.away_score

  if (isExact) {
    const pts = (config.correct_result_pts + config.exact_score_bonus) * pick.confidence_multiplier
    return { points: pts, result: 'EXACT' }
  }

  if (actualResult === pickedResult) {
    const pts = config.correct_result_pts * pick.confidence_multiplier
    return { points: pts, result: 'CORRECT' }
  }

  return { points: 0, result: 'WRONG' }
}

// Used server-side to bulk score all picks for a finished match
export function scoreAllPicksForMatch(
  picks: Array<{ home_score_pick: number; away_score_pick: number; confidence_multiplier: number }>,
  match: { home_score: number; away_score: number },
  config: ScoringConfig = DEFAULT_CONFIG
) {
  return picks.map(p => scorePick(p, match, config))
}

// Preview: what points could a user earn with a given pick (before match finishes)
export function previewPickPoints(
  homeScorePick: number,
  awayScorePick: number,
  multiplier: number = 1,
  config: ScoringConfig = DEFAULT_CONFIG
) {
  const correctPts = config.correct_result_pts * multiplier
  const exactPts = (config.correct_result_pts + config.exact_score_bonus) * multiplier
  return { correctPts, exactPts }
}

// Summarize a user's picks stats
export function summarizePicks(picks: Array<{ points_earned: number | null; pick_result: string | null }>) {
  return picks.reduce(
    (acc, p) => {
      acc.total += p.points_earned ?? 0
      if (p.pick_result === 'EXACT') acc.exact++
      if (p.pick_result === 'CORRECT' || p.pick_result === 'EXACT') acc.correct++
      if (p.pick_result !== null) acc.scored++
      return acc
    },
    { total: 0, exact: 0, correct: 0, scored: 0 }
  )
}
