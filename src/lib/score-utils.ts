// Shared scoring logic — called from route handlers and the simulate route.
// Both functions accept an admin SupabaseClient so they can be composed.

import type { SupabaseClient } from '@supabase/supabase-js'
import { scoreBracketEntry } from './bracket-scoring'

// ── Picks scoring ─────────────────────────────────────────────────────────────

export async function scorePicks(
  supabase: SupabaseClient,
): Promise<{ scored: number; users: number }> {
  // All pick scoring + standings aggregation runs in ONE set-based DB call
  // (public.score_picks). The previous implementation fanned out one REST
  // request per pick and per user via Promise.all; on Cloudflare Workers that
  // exceeded the subrequest / 6-concurrent-connection limit and routinely left
  // global_scores un-aggregated — the "scored N picks across 0 users" /
  // 0-points-on-Stats bug. The RPC is idempotent: re-running it rebuilds
  // standings from the scored picks, so it also repairs a zeroed aggregation.
  const { data, error } = await supabase.rpc('score_picks')
  if (error) throw new Error(`score_picks failed: ${error.message}`)
  const r = (data ?? {}) as { scored?: number; users?: number }
  return { scored: r.scored ?? 0, users: r.users ?? 0 }
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
