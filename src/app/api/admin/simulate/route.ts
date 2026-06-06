// POST /api/admin/simulate
// Simulates tournament progression for testing purposes.
// body: { action: 'group' | 'bracket' | 'full' | 'reset' }

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/admin'
import { scorePicks, scoreBrackets } from '@/lib/score-utils'

async function guard(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user && isAdminUser(user.id)
  } catch { return false }
}

// ── Score generators ──────────────────────────────────────────────────────────

function rndGroupScore(): [number, number] {
  const r = Math.random()
  if (r < 0.44) {                                    // home win ~44%
    const a = Math.floor(Math.random() * 2)
    return [a + 1 + Math.floor(Math.random() * 2), a]
  }
  if (r < 0.68) {                                    // draw ~24%
    const g = Math.floor(Math.random() * 3)
    return [g, g]
  }
  const h = Math.floor(Math.random() * 2)            // away win ~32%
  return [h, h + 1 + Math.floor(Math.random() * 2)]
}

function rndKOWinner(a: string, b: string): string {
  return Math.random() < 0.5 ? a : b
}

// ── Group standings ───────────────────────────────────────────────────────────

type MatchResult = { homeId: string; awayId: string; hs: number; as: number }
type Stats = { pts: number; gd: number; gf: number }

function teamStats(teamId: string, matches: MatchResult[]): Stats {
  let pts = 0, gd = 0, gf = 0
  for (const m of matches) {
    if (m.homeId === teamId) {
      gf += m.hs; gd += m.hs - m.as
      if (m.hs > m.as) pts += 3
      else if (m.hs === m.as) pts += 1
    } else if (m.awayId === teamId) {
      gf += m.as; gd += m.as - m.hs
      if (m.as > m.hs) pts += 3
      else if (m.as === m.hs) pts += 1
    }
  }
  return { pts, gd, gf }
}

function rankTeams(teamIds: string[], matches: MatchResult[]): string[] {
  return [...teamIds].sort((a, b) => {
    const sa = teamStats(a, matches), sb = teamStats(b, matches)
    if (sb.pts !== sa.pts) return sb.pts - sa.pts
    if (sb.gd !== sa.gd) return sb.gd - sa.gd
    return sb.gf - sa.gf
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await req.json()
  const db = createAdminSupabaseClient()

  // ── RESET ──────────────────────────────────────────────────────────────────
  if (action === 'reset') {
    await db.from('matches')
      .update({ status: 'SCHEDULED', home_score: null, away_score: null })
      .eq('stage', 'GROUP')

    await db.from('picks')
      .update({ scored_at: null, points_earned: null, pick_result: null })
      .not('scored_at', 'is', null)

    await db.from('global_scores')
      .update({ total_points: 0, picks_points: 0, bracket_points: 0, picks_correct: 0, bracket_correct: 0, correct_results: 0, picks_made: 0, global_rank: null, updated_at: new Date().toISOString() })
      .neq('user_id', '00000000-0000-0000-0000-000000000000')

    await db.from('tournament_results').update({
      group_results: {}, third_quals: [],
      r32_results: [], r16_results: [], qf_results: [], sf_results: [],
      final_result: null, updated_at: new Date().toISOString(),
    }).eq('id', 1)

    return NextResponse.json({ ok: true, message: 'Reset complete — all matches SCHEDULED, scores cleared' })
  }

  // ── GROUP STAGE ────────────────────────────────────────────────────────────
  let groupResults: Record<string, { first: string; second: string; third: string }> = {}
  let thirdQuals: string[] = []

  if (action === 'group' || action === 'full') {
    const { data: matches, error } = await db
      .from('matches')
      .select('id, home_team_id, away_team_id, group_letter, home_team:teams!matches_home_team_id_fkey(id,name), away_team:teams!matches_away_team_id_fkey(id,name)')
      .eq('stage', 'GROUP')

    if (error || !matches?.length) {
      return NextResponse.json({ error: 'No GROUP matches found' }, { status: 400 })
    }

    // Generate scores for every group match
    const scored = matches.map(m => {
      const [hs, as_] = rndGroupScore()
      return {
        id: m.id,
        group_letter: m.group_letter as string,
        homeId: m.home_team_id,
        awayId: m.away_team_id,
        homeName: (m.home_team as any).name as string,
        awayName: (m.away_team as any).name as string,
        hs, as: as_,
      }
    })

    // Single RPC call updates all group matches in one DB transaction
    // (72 parallel fetch() calls hit CF Workers' 6-concurrent-connection limit)
    await db.rpc('bulk_finish_matches', {
      matches: scored.map(m => ({ id: m.id, home_score: m.hs, away_score: m.as })),
    })

    // Compute standings per group
    const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
    const allThirds: Array<{ team: string } & Stats> = []

    for (const g of GROUPS) {
      const gm = scored.filter(m => m.group_letter === g)
      const nameMap: Record<string, string> = {}
      gm.forEach(m => { nameMap[m.homeId] = m.homeName; nameMap[m.awayId] = m.awayName })
      const teamIds = Object.keys(nameMap)
      const results: MatchResult[] = gm.map(m => ({ homeId: m.homeId, awayId: m.awayId, hs: m.hs, as: m.as }))
      const ranked = rankTeams(teamIds, results)

      groupResults[g] = {
        first:  nameMap[ranked[0]],
        second: nameMap[ranked[1]],
        third:  nameMap[ranked[2]],
      }

      if (ranked[2]) {
        allThirds.push({ team: nameMap[ranked[2]], ...teamStats(ranked[2], results) })
      }
    }

    // Best 8 third-place teams
    allThirds.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      if (b.gd !== a.gd) return b.gd - a.gd
      return b.gf - a.gf
    })
    thirdQuals = allThirds.slice(0, 8).map(t => t.team)

    await db.from('tournament_results')
      .update({ group_results: groupResults, third_quals: thirdQuals, updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (action === 'group') {
      // Auto-score picks now that all group matches are FINISHED
      await scorePicks(db)
      return NextResponse.json({
        ok: true,
        message: `Group stage done — ${matches.length} matches scored, standings computed, picks scored`,
      })
    }
  }

  // ── BRACKET ROUNDS (r32 → final) ───────────────────────────────────────────
  if (action === 'bracket' || action === 'full') {
    // Load group results if not just computed above
    if (Object.keys(groupResults).length === 0) {
      const { data: tr } = await db.from('tournament_results').select('group_results, third_quals').eq('id', 1).single()
      if (!tr?.group_results || Object.keys(tr.group_results).length === 0) {
        return NextResponse.json({ error: 'Simulate group stage first' }, { status: 400 })
      }
      groupResults = tr.group_results
      thirdQuals = tr.third_quals ?? []
    }

    const gr = groupResults
    const tq = thirdQuals

    // R32 matchups mirror R32_FIXTURES in bracket.ts
    const r32Pairs: Array<[string | undefined, string | undefined]> = [
      [gr.A?.first, gr.B?.second],
      [gr.B?.first, gr.A?.second],
      [gr.C?.first, gr.D?.second],
      [gr.D?.first, gr.C?.second],
      [gr.E?.first, gr.F?.second],
      [gr.F?.first, gr.E?.second],
      [gr.G?.first, gr.H?.second],
      [gr.H?.first, gr.G?.second],
      [gr.I?.first, gr.J?.second],
      [gr.J?.first, gr.I?.second],
      [gr.K?.first, gr.L?.second],
      [gr.L?.first, gr.K?.second],
      [tq[0], tq[7]],
      [tq[1], tq[6]],
      [tq[2], tq[5]],
      [tq[3], tq[4]],
    ]
    const r32Results = r32Pairs.map(([a, b]) => a && b ? rndKOWinner(a, b) : null)

    // R16 — winners from pairs of R32 slots
    const r16Results = [[0,1],[2,3],[4,5],[6,7],[8,9],[10,11],[12,13],[14,15]].map(([i, j]) => {
      const a = r32Results[i], b = r32Results[j]
      return a && b ? rndKOWinner(a, b) : null
    })

    // QF
    const qfResults = [[0,1],[2,3],[4,5],[6,7]].map(([i, j]) => {
      const a = r16Results[i], b = r16Results[j]
      return a && b ? rndKOWinner(a, b) : null
    })

    // SF
    const sfResults = [[0,1],[2,3]].map(([i, j]) => {
      const a = qfResults[i], b = qfResults[j]
      return a && b ? rndKOWinner(a, b) : null
    })

    // Final
    const finalResult = sfResults[0] && sfResults[1] ? rndKOWinner(sfResults[0], sfResults[1]) : null

    await db.from('tournament_results').update({
      r32_results: r32Results,
      r16_results: r16Results,
      qf_results:  qfResults,
      sf_results:  sfResults,
      final_result: finalResult,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)

    // Auto-score: picks first (so bracket scoring reads correct picks_points),
    // then brackets. For 'bracket' action picks were scored in a prior group sim.
    if (action === 'full') await scorePicks(db)
    await scoreBrackets(db)

    return NextResponse.json({
      ok: true,
      message: `Full tournament simulated — champion: ${finalResult ?? 'TBD'}, scores updated`,
      champion: finalResult,
    })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
