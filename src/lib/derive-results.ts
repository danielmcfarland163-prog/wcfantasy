// Derive tournament_results from real match outcomes â€” Blocker B4 (Path A).
//
// score-bracket scores brackets off tournament_results, but nothing populated
// that table from real results (only the admin simulator did), so in production it
// scored 0 regardless of sync-fixtures. This module computes:
//   - group_results (1st/2nd/3rd per group) + best-8 third_quals â€” from finished
//     GROUP matches, reusing computeGroupStandings() (same tiebreakers as the app);
//   - r32..final â€” from knockout match WINNERS (winner_team_id, which covers
//     extra-time/penalties), walked through the same bracket flow the picks use.
//
// The six-hourly cron runs sync-fixtures -> derive-results -> score-bracket. The
// pure core (computeTournamentResults) is unit-tested in isolation; deriveResults()
// is the thin DB wrapper that loads rows and upserts the single results row.

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeGroupStandings, type StandingsMatch } from './standings'

export interface DeriveTeam { id: string; name: string; short_code: string }

export interface DeriveMatch {
  stage: string
  group_letter: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  home_team: DeriveTeam | null
  away_team: DeriveTeam | null
  winner_name: string | null // resolved name of winner_team_id (knockouts); null otherwise
}

export interface TournamentResults {
  group_results: Record<string, { first: string | null; second: string | null; third: string | null }>
  third_quals: (string | null)[]
  r32_results: (string | null)[]
  r16_results: (string | null)[]
  qf_results: (string | null)[]
  sf_results: (string | null)[]
  final_result: string | null
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const

// Order-independent key for the two participants of a knockout tie.
const pairKey = (a: string, b: string) => [a, b].sort().join(' | ')

/**
 * Pure: given all match rows (group + knockout, knockout winners resolved to
 * names), compute the full tournament_results. Rounds with no result yet yield
 * nulls in the right slot positions, matching the pick indices score-bracket uses.
 */
export function computeTournamentResults(matches: DeriveMatch[]): TournamentResults {
  // Groups -> first/second/third + best-8 third-placed qualifiers
  const groupMatches: StandingsMatch[] = matches
    .filter((m) => m.stage === 'GROUP')
    .map((m) => ({
      group_letter: m.group_letter,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      home_team: m.home_team,
      away_team: m.away_team,
    }))
  const standings = computeGroupStandings(groupMatches)

  const group_results: TournamentResults['group_results'] = {}
  const thirds: { name: string; pts: number; gd: number; gf: number }[] = []
  for (const g of GROUPS) {
    const rows = standings[g] ?? []
    group_results[g] = {
      first: rows[0]?.name ?? null,
      second: rows[1]?.name ?? null,
      third: rows[2]?.name ?? null,
    }
    if (rows[2]) thirds.push({ name: rows[2].name, pts: rows[2].pts, gd: rows[2].gd, gf: rows[2].gf })
  }
  // Best 8 third-placed teams (pts -> gd -> gf, name as a deterministic final tiebreak).
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
  const third_quals: (string | null)[] = thirds.slice(0, 8).map((t) => t.name)

  // Knockout winners, indexed by participant pair within each stage.
  const koByStage: Record<string, Map<string, string>> = {
    R32: new Map(), R16: new Map(), QF: new Map(), SF: new Map(), FINAL: new Map(),
  }
  for (const m of matches) {
    if (m.stage === 'GROUP' || m.status !== 'FINISHED') continue
    if (!m.home_team || !m.away_team || !m.winner_name) continue
    koByStage[m.stage]?.set(pairKey(m.home_team.name, m.away_team.name), m.winner_name)
  }
  const winnerOf = (stage: string, a: string | null, b: string | null): string | null =>
    a && b ? koByStage[stage]?.get(pairKey(a, b)) ?? null : null

  // Expected R32 participants per slot â€” mirrors R32_FIXTURES (lib/bracket.ts) and
  // the simulator's r32Pairs, so slot indices line up with the bracket picks.
  const gr = group_results
  const tq = third_quals
  const r32Pairs: [string | null, string | null][] = [
    [gr.A.first, gr.B.second], [gr.B.first, gr.A.second],
    [gr.C.first, gr.D.second], [gr.D.first, gr.C.second],
    [gr.E.first, gr.F.second], [gr.F.first, gr.E.second],
    [gr.G.first, gr.H.second], [gr.H.first, gr.G.second],
    [gr.I.first, gr.J.second], [gr.J.first, gr.I.second],
    [gr.K.first, gr.L.second], [gr.L.first, gr.K.second],
    [tq[0] ?? null, tq[7] ?? null], [tq[1] ?? null, tq[6] ?? null],
    [tq[2] ?? null, tq[5] ?? null], [tq[3] ?? null, tq[4] ?? null],
  ]

  const r32_results = r32Pairs.map(([a, b]) => winnerOf('R32', a, b))
  const r16_results = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15]]
    .map(([i, j]) => winnerOf('R16', r32_results[i], r32_results[j]))
  const qf_results = [[0, 1], [2, 3], [4, 5], [6, 7]]
    .map(([i, j]) => winnerOf('QF', r16_results[i], r16_results[j]))
  const sf_results = [[0, 1], [2, 3]]
    .map(([i, j]) => winnerOf('SF', qf_results[i], qf_results[j]))
  const final_result = winnerOf('FINAL', sf_results[0], sf_results[1])

  return { group_results, third_quals, r32_results, r16_results, qf_results, sf_results, final_result }
}

// Supabase embeds a to-one relation as an object, but the typings sometimes widen
// it to an array â€” normalize either shape to a single team ref.
function one(rel: any): DeriveTeam | null {
  const t = Array.isArray(rel) ? rel[0] : rel
  return t ? { id: t.id, name: t.name, short_code: t.short_code } : null
}

/**
 * Load matches, resolve knockout winners, recompute and persist tournament_results.
 * Idempotent â€” safe to run on every six-hourly cron tick; rebuilds from current results.
 */
export async function deriveResults(
  supabase: SupabaseClient,
): Promise<{ scored: number; results: TournamentResults }> {
  const { data: rows, error } = await supabase
    .from('matches')
    .select(
      'stage, group_letter, status, home_score, away_score, winner_team_id, ' +
        'home_team:teams!matches_home_team_id_fkey(id,name,short_code), ' +
        'away_team:teams!matches_away_team_id_fkey(id,name,short_code)',
    )
  if (error) throw new Error(`derive-results load failed: ${error.message}`)

  const matches: DeriveMatch[] = (rows ?? []).map((r: any) => {
    const home = one(r.home_team)
    const away = one(r.away_team)
    let winner_name: string | null = null
    if (r.winner_team_id && home && home.id === r.winner_team_id) winner_name = home.name
    else if (r.winner_team_id && away && away.id === r.winner_team_id) winner_name = away.name
    return {
      stage: r.stage,
      group_letter: r.group_letter,
      status: r.status,
      home_score: r.home_score,
      away_score: r.away_score,
      home_team: home,
      away_team: away,
      winner_name,
    }
  })

  const results = computeTournamentResults(matches)

  const { error: upErr } = await supabase
    .from('tournament_results')
    .update({ ...results, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (upErr) throw new Error(`derive-results write failed: ${upErr.message}`)

  // "scored" = count of resolved knockout slots, for a quick health signal in logs.
  const scored = [
    ...results.r32_results, ...results.r16_results, ...results.qf_results,
    ...results.sf_results, results.final_result,
  ].filter(Boolean).length

  return { scored, results }
}

