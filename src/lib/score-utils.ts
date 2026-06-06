// Shared scoring logic — called from route handlers and the simulate route.
// Both functions accept an admin SupabaseClient so they can be composed.

import type { SupabaseClient } from '@supabase/supabase-js'
import { scorePick } from './scoring'
import { scoreBracketEntry } from './bracket-scoring'

// ── Picks scoring ─────────────────────────────────────────────────────────────

export async function scorePicks(
  supabase: SupabaseClient,
): Promise<{ scored: number; users: number }> {
  // Finished matches with scores
  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('id, home_score, away_score')
    .eq('status', 'FINISHED')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)

  if (!finishedMatches?.length) return { scored: 0, users: 0 }

  const finishedIds = finishedMatches.map((m: any) => m.id)
  const scoreMap = Object.fromEntries(
    finishedMatches.map((m: any) => [m.id, { home: m.home_score as number, away: m.away_score as number }]),
  )

  // Unscored picks for those matches
  const { data: unscoredPicks } = await supabase
    .from('picks')
    .select('id, user_id, match_id, home_score_pick, away_score_pick, confidence_multiplier')
    .is('scored_at', null)
    .in('match_id', finishedIds)

  if (!unscoredPicks?.length) return { scored: 0, users: 0 }

  // Score each pick with the scoreline model: 0 (wrong) / 3 (correct outcome) /
  // 5 (exact score), multiplied by the confidence multiplier (1×/2×/3×).
  const updates: Array<{ id: string; user_id: string; points: number; result: 'EXACT' | 'CORRECT' | 'WRONG' }> = []
  for (const pick of unscoredPicks as any[]) {
    const scores = scoreMap[pick.match_id]
    if (!scores) continue
    const { points, result } = scorePick(
      {
        home_score_pick: pick.home_score_pick ?? 0,
        away_score_pick: pick.away_score_pick ?? 0,
        confidence_multiplier: pick.confidence_multiplier ?? 1,
      },
      { home_score: scores.home, away_score: scores.away },
    )
    updates.push({ id: pick.id, user_id: pick.user_id, points, result })
  }

  if (!updates.length) return { scored: 0, users: 0 }

  // Persist per-pick scores
  await Promise.all(updates.map(u =>
    supabase.from('picks').update({
      points_earned: u.points,
      pick_result:   u.result,
      scored_at:     new Date().toISOString(),
    }).eq('id', u.id),
  ))

  // Re-aggregate standings for EVERY user with any scored pick (keeps this idempotent —
  // re-running over already-scored matches recomputes the same totals).
  const { data: scoredRows } = await supabase
    .from('picks')
    .select('user_id, points_earned, pick_result')
    .not('scored_at', 'is', null)

  type Agg = { pts: number; correct: number; exact: number; made: number }
  const byUser = new Map<string, Agg>()
  for (const r of (scoredRows ?? []) as any[]) {
    const a = byUser.get(r.user_id) ?? { pts: 0, correct: 0, exact: 0, made: 0 }
    a.pts += r.points_earned ?? 0
    if (r.pick_result === 'EXACT') { a.exact++; a.correct++ }
    else if (r.pick_result === 'CORRECT') { a.correct++ }
    a.made++
    byUser.set(r.user_id, a)
  }

  for (const [userId, a] of byUser) {
    // Preserve any bracket points when computing the combined total
    const { data: existing } = await supabase
      .from('global_scores')
      .select('bracket_points')
      .eq('user_id', userId)
      .single()
    const bracketPts = existing?.bracket_points ?? 0

    await supabase.from('global_scores').upsert({
      user_id:         userId,
      picks_points:    a.pts,
      picks_correct:   a.correct,
      exact_scores:    a.exact,
      correct_results: a.correct,
      picks_made:      a.made,
      total_points:    a.pts + bracketPts,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' })

    const { data: leagues } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', userId)

    for (const lm of (leagues ?? []) as any[]) {
      // Write the Picks-mode columns; bracket_points is preserved and the
      // combined total_points is recomputed by recalculate_league_rankings().
      await supabase.from('league_scores').upsert({
        league_id:       lm.league_id,
        user_id:         userId,
        picks_points:    a.pts,
        total_points:    a.pts,
        correct_results: a.correct,
        exact_scores:    a.exact,
        picks_made:      a.made,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'league_id,user_id' })
      await supabase.rpc('recalculate_league_rankings', { p_league_id: lm.league_id })
    }
  }

  // Recompute global ranks by total points
  const { data: allScores } = await supabase
    .from('global_scores')
    .select('user_id')
    .order('total_points', { ascending: false })

  for (let i = 0; i < (allScores ?? []).length; i++) {
    await supabase
      .from('global_scores')
      .update({ global_rank: i + 1 })
      .eq('user_id', (allScores as any[])[i].user_id)
  }

  return { scored: updates.length, users: byUser.size }
}

// ── Bracket scoring ───────────────────────────────────────────────────────────
// Works with partial results — e.g. after R32 is done but before R16.
// Points are awarded for whatever rounds have results; rounds with empty results
// simply contribute 0 points (no penalty for later rounds not yet played).

export async function scoreBrackets(
  supabase: SupabaseClient,
): Promise<{ scored: number }> {
  const { data: res } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('id', 1)
    .single()

  if (!res) return { scored: 0 }

  const { data: entries } = await supabase.from('bracket_entries').select('*')
  if (!entries?.length) return { scored: 0 }

  const nowIso = new Date().toISOString()
  let scored = 0

  for (const entry of entries) {
    // Single source of truth for point values (GDD §2.2): see lib/bracket-scoring.ts
    const { points, correct } = scoreBracketEntry(entry, res)

    // ── Global scores: write only the Bracket-mode columns; preserve Picks ──
    const { data: existing } = await supabase
      .from('global_scores')
      .select('picks_points')
      .eq('user_id', entry.user_id)
      .single()
    const picksPts = existing?.picks_points ?? 0

    await supabase.from('global_scores').upsert({
      user_id:         entry.user_id,
      bracket_points:  points,
      bracket_correct: correct,
      total_points:    picksPts + points,
      updated_at:      nowIso,
    }, { onConflict: 'user_id' })

    // ── League scores: set bracket_points only. recalculate_league_rankings()
    //    recomputes total_points (= picks + bracket) and both rank columns, so
    //    the member's Picks score is never clobbered. ──
    const { data: memberships } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', entry.user_id)

    for (const { league_id } of (memberships ?? [])) {
      await supabase.from('league_scores').upsert({
        league_id,
        user_id:        entry.user_id,
        bracket_points: points,
        updated_at:     nowIso,
      }, { onConflict: 'league_id,user_id' })
      await supabase.rpc('recalculate_league_rankings', { p_league_id: league_id })
    }

    scored++
  }

  return { scored }
}
