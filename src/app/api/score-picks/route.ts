export const runtime = 'edge'
// Cron: runs every 10 minutes
// Scores all un-scored picks for finished matches
// Updates picks, global_scores, and league_scores tables

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { scorePick } from '@/lib/scoring'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  try {
    // Load scoring config
    const { data: configRows } = await supabase.from('scoring_config').select('*')
    const config = Object.fromEntries((configRows ?? []).map(r => [r.key, Number(r.value)])) as any

    // Find finished matches with un-scored picks
    const { data: unscoredPicks } = await supabase
      .from('picks')
      .select(`
        id, user_id, match_id, home_score_pick, away_score_pick, confidence_multiplier,
        match:matches(id, home_score, away_score, status)
      `)
      .is('scored_at', null)
      .eq('match.status', 'FINISHED')
      .not('match', 'is', null)

    if (!unscoredPicks || unscoredPicks.length === 0) {
      return NextResponse.json({ message: 'Nothing to score', scored: 0 })
    }

    // Score each pick
    const updates: Array<{ id: string; points: number; result: string; user_id: string }> = []

    for (const pick of unscoredPicks) {
      const match = pick.match as any
      if (match?.home_score === null || match?.away_score === null) continue

      const { points, result } = scorePick(
        { home_score_pick: pick.home_score_pick, away_score_pick: pick.away_score_pick, confidence_multiplier: pick.confidence_multiplier },
        { home_score: match.home_score, away_score: match.away_score },
        config
      )

      updates.push({ id: pick.id, points, result, user_id: pick.user_id })
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No picks ready to score', scored: 0 })
    }

    // Batch update picks
    for (const u of updates) {
      await supabase
        .from('picks')
        .update({ points_earned: u.points, pick_result: u.result, scored_at: new Date().toISOString() })
        .eq('id', u.id)
    }

    // Recompute global scores per affected user
    const affectedUsers = [...new Set(updates.map(u => u.user_id))]
    for (const userId of affectedUsers) {
      const { data: userPicks } = await supabase
        .from('picks')
        .select('points_earned, pick_result')
        .eq('user_id', userId)
        .not('scored_at', 'is', null)

      const total = (userPicks ?? []).reduce((s, p) => s + (p.points_earned ?? 0), 0)
      const correct = (userPicks ?? []).filter(p => p.pick_result === 'CORRECT' || p.pick_result === 'EXACT').length
      const exact = (userPicks ?? []).filter(p => p.pick_result === 'EXACT').length
      const made = (userPicks ?? []).length

      await supabase.from('global_scores').upsert(
        { user_id: userId, total_points: total, correct_results: correct, exact_scores: exact, picks_made: made, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

      // Update league scores for each league this user is in
      const { data: leagues } = await supabase
        .from('league_members')
        .select('league_id')
        .eq('user_id', userId)

      for (const lm of (leagues ?? [])) {
        await supabase.from('league_scores').upsert(
          { league_id: lm.league_id, user_id: userId, total_points: total, correct_results: correct, exact_scores: exact, picks_made: made, updated_at: new Date().toISOString() },
          { onConflict: 'league_id,user_id' }
        )
        // Recompute rankings for this league
        await supabase.rpc('recalculate_league_rankings', { p_league_id: lm.league_id })
      }
    }

    // Recompute global ranks
    const { data: allScores } = await supabase
      .from('global_scores')
      .select('user_id')
      .order('total_points', { ascending: false })

    for (let i = 0; i < (allScores ?? []).length; i++) {
      await supabase
        .from('global_scores')
        .update({ global_rank: i + 1 })
        .eq('user_id', allScores![i].user_id)
    }

    return NextResponse.json({ message: 'Scoring complete', scored: updates.length, users: affectedUsers.length })
  } catch (err: any) {
    console.error('[score-picks]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
