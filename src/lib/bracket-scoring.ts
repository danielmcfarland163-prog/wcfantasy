// =============================================
// BRACKET SCORING — single source of truth
// =============================================
// Used by BOTH the server scoring engine (lib/score-utils.ts → api/score-bracket)
// AND the UI (BracketClient summary, BracketReviewer) so points never drift.
//
// Point values follow GDD §2.2 / the bracket deployment spec exactly:
//   Group 1st correct          2
//   Group 2nd correct          2
//   3rd-place qualifier        2
//   Round of 32 winner         3
//   Round of 16 winner         5
//   Quarter-final winner       8
//   Semi-final winner         13
//   Final winner (champion)   21
//
// This module is intentionally dependency-free (no '@/' imports) so it can be
// imported from anywhere and unit-tested in isolation.

export const BRACKET_PTS = {
  group1st: 2,
  group2nd: 2,
  third: 2,
  r32: 3,
  r16: 5,
  qf: 8,
  sf: 13,
  champion: 21,
} as const

// Static maximum slot counts per section (used for "X / Y correct" displays).
export const BRACKET_TOTALS = {
  group1st: 12,
  group2nd: 12,
  groups: 24, // 1st + 2nd across 12 groups
  third: 8,
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
} as const

export interface BracketEntryLike {
  group_picks?: Record<string, { first?: string | null; second?: string | null }> | null
  third_quals?: (string | null)[] | null
  r32_picks?: (string | null)[] | null
  r16_picks?: (string | null)[] | null
  qf_picks?: (string | null)[] | null
  sf_picks?: (string | null)[] | null
  final_pick?: string | null
}

export interface TournamentResultsLike {
  group_results?: Record<string, { first?: string | null; second?: string | null; third?: string | null }> | null
  third_quals?: (string | null)[] | null
  r32_results?: (string | null)[] | null
  r16_results?: (string | null)[] | null
  qf_results?: (string | null)[] | null
  sf_results?: (string | null)[] | null
  final_result?: string | null
}

export interface BreakdownRow {
  key: 'groups' | 'third' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  label: string
  correct: number
  total: number      // static max slot count for the section
  points: number     // points actually earned
  hasResults: boolean // whether any actual result exists for this section yet
}

export interface BracketScore {
  points: number          // total bracket points earned
  correct: number         // total correct picks across all sections
  championCorrect: number // 1 if the Final pick is correct, else 0
  picksMade: number       // completeness count (how many slots the user filled)
  breakdown: BreakdownRow[]
}

function arr(x: (string | null)[] | null | undefined): (string | null)[] {
  return Array.isArray(x) ? x : []
}

export type BracketScoringMode = 'pickem' | 'reset'

/**
 * Score a single bracket entry against the (possibly partial) tournament results.
 * Rounds with no results yet simply contribute 0 — there is no penalty for
 * future rounds that haven't been played.
 *
 * Two scoring shapes, by mode:
 *   reset  — knockout picks are matchup winners; scored by bracket POSITION
 *            (pick[i] === actual[i]).
 *   pickem — knockout picks are a SURVIVOR POOL ("these teams reach this round"),
 *            scored by SET MEMBERSHIP (the picked team is anywhere in that round's
 *            actual advancer set), independent of matchup. A missed group pick can
 *            no longer cascade through a bracket of fixed matchups.
 * Point values, totals and the 231 max are identical for both modes.
 */
export function scoreBracketEntry(
  entry: BracketEntryLike,
  results: TournamentResultsLike | null | undefined,
  mode: BracketScoringMode = 'reset',
): BracketScore {
  const isPickem = mode === 'pickem'
  const gp = entry.group_picks ?? {}
  const gr = results?.group_results ?? {}
  const groupKeys = Object.keys(gr)

  // ── Group stage (1st + 2nd) ──
  let group1st = 0
  let group2nd = 0
  for (const gk of groupKeys) {
    const actual = gr[gk]
    if (!actual) continue
    if (actual.first && gp[gk]?.first === actual.first) group1st++
    if (actual.second && gp[gk]?.second === actual.second) group2nd++
  }
  const groupsHasResults = groupKeys.length > 0
  const groupsCorrect = group1st + group2nd
  const groupsPoints = group1st * BRACKET_PTS.group1st + group2nd * BRACKET_PTS.group2nd

  // ── 3rd-place qualifiers ──
  const actualThird = arr(results?.third_quals)
  let third = 0
  for (const nm of arr(entry.third_quals)) {
    if (nm && actualThird.includes(nm)) third++
  }
  const thirdHasResults = actualThird.some(Boolean)
  const thirdPoints = third * BRACKET_PTS.third

  // ── Knockout rounds ──
  // reset  → positional (pick[i] === actual[i]).
  // pickem → set membership: how many of the picked teams are anywhere in this
  //          round's actual advancer set (dedup'd; matchup-independent).
  const scoreRound = (
    picks: (string | null)[] | null | undefined,
    actuals: (string | null)[] | null | undefined,
    ptVal: number,
  ): { correct: number; points: number; hasResults: boolean } => {
    const p = arr(picks)
    const a = arr(actuals)
    const hasResults = a.some(Boolean)
    let correct = 0
    if (isPickem) {
      const actualSet = new Set(a.filter(Boolean) as string[])
      const seen = new Set<string>()
      for (const pick of p) {
        if (pick && !seen.has(pick) && actualSet.has(pick)) {
          correct++
          seen.add(pick)
        }
      }
    } else {
      p.forEach((pick, i) => {
        if (pick && a[i] && pick === a[i]) correct++
      })
    }
    return { correct, points: correct * ptVal, hasResults }
  }

  const r32 = scoreRound(entry.r32_picks, results?.r32_results, BRACKET_PTS.r32)
  const r16 = scoreRound(entry.r16_picks, results?.r16_results, BRACKET_PTS.r16)
  const qf = scoreRound(entry.qf_picks, results?.qf_results, BRACKET_PTS.qf)
  const sf = scoreRound(entry.sf_picks, results?.sf_results, BRACKET_PTS.sf)

  // ── Champion (Final) ──
  const finalResult = results?.final_result ?? null
  const championCorrect = entry.final_pick && finalResult && entry.final_pick === finalResult ? 1 : 0
  const finalPoints = championCorrect * BRACKET_PTS.champion
  const finalHasResults = !!finalResult

  const points = groupsPoints + thirdPoints + r32.points + r16.points + qf.points + sf.points + finalPoints
  const correct = groupsCorrect + third + r32.correct + r16.correct + qf.correct + sf.correct + championCorrect

  // ── Completeness (picks made) ──
  const groupsFilled = Object.values(gp).filter((p) => p?.first && p?.second).length * 2
  const knockoutFilled = [
    ...arr(entry.r32_picks),
    ...arr(entry.r16_picks),
    ...arr(entry.qf_picks),
    ...arr(entry.sf_picks),
  ].filter(Boolean).length
  const picksMade =
    groupsFilled + arr(entry.third_quals).filter(Boolean).length + knockoutFilled + (entry.final_pick ? 1 : 0)

  // In pickem the knockout picks name the teams that REACH each round, so the
  // labels read one round "ahead" of the matchup (reset) framing.
  const koLabels = isPickem
    ? { r32: 'Round of 16', r16: 'Quarter-finals', qf: 'Semi-finals', sf: 'Final', final: 'Champion' }
    : { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-finals', sf: 'Semi-finals', final: 'Final' }

  const breakdown: BreakdownRow[] = [
    { key: 'groups', label: 'Group stage', correct: groupsCorrect, total: BRACKET_TOTALS.groups, points: groupsPoints, hasResults: groupsHasResults },
    { key: 'third', label: '3rd-place', correct: third, total: BRACKET_TOTALS.third, points: thirdPoints, hasResults: thirdHasResults },
    { key: 'r32', label: koLabels.r32, correct: r32.correct, total: BRACKET_TOTALS.r32, points: r32.points, hasResults: r32.hasResults },
    { key: 'r16', label: koLabels.r16, correct: r16.correct, total: BRACKET_TOTALS.r16, points: r16.points, hasResults: r16.hasResults },
    { key: 'qf', label: koLabels.qf, correct: qf.correct, total: BRACKET_TOTALS.qf, points: qf.points, hasResults: qf.hasResults },
    { key: 'sf', label: koLabels.sf, correct: sf.correct, total: BRACKET_TOTALS.sf, points: sf.points, hasResults: sf.hasResults },
    { key: 'final', label: koLabels.final, correct: championCorrect, total: BRACKET_TOTALS.final, points: finalPoints, hasResults: finalHasResults },
  ]

  return { points, correct, championCorrect, picksMade, breakdown }
}

// Theoretical maximum bracket score (every pick correct):
//   groups 24×2=48 · third 8×2=16 · r32 16×3=48 · r16 8×5=40
//   qf 4×8=32 · sf 2×13=26 · final 1×21=21  →  TOTAL 231
export const BRACKET_MAX_POINTS = 231

/**
 * Whether a single knockout pick should render as correct (✓), wrong (✗) or
 * undecided (null) — mode-aware, for the summary / reviewer chip displays.
 *   reset  → positional: the team that actually won this exact slot.
 *   pickem → membership: the team appears anywhere in the round's advancer set.
 *            Stays `null` (pending) until the round is fully decided, so a team
 *            whose match hasn't happened yet isn't prematurely marked wrong.
 */
export function knockoutPickCorrect(
  nm: string,
  slot: number,
  actuals: (string | null)[] | null | undefined,
  isPickem: boolean,
): boolean | null {
  const a = actuals ?? []
  if (isPickem) {
    if (a.includes(nm)) return true
    return a.length > 0 && a.every(Boolean) ? false : null
  }
  return a[slot] ? nm === a[slot] : null
}
