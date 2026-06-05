// =============================================
// WORLD CUP FANTASY 2026 — SHARED TYPES
// =============================================

export type MatchStage = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL'
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED'
export type PickResult = 'EXACT' | 'CORRECT' | 'WRONG'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Team {
  id: string
  name: string
  short_code: string
  group_letter: string | null
  flag_emoji: string | null
  api_id: number | null
  eliminated: boolean
}

export interface Match {
  id: string
  api_match_id: number | null
  home_team_id: string
  away_team_id: string
  kickoff_time: string
  stage: MatchStage
  group_letter: string | null
  home_score: number | null
  away_score: number | null
  status: MatchStatus
  // joined
  home_team?: Team
  away_team?: Team
}

export interface Pick {
  id: string
  user_id: string
  match_id: string
  home_score_pick: number
  away_score_pick: number
  confidence_multiplier: 1 | 2 | 3
  points_earned: number | null
  pick_result: PickResult | null
  scored_at: string | null
  created_at: string
  // joined
  match?: Match
}

export interface TournamentPick {
  id: string
  user_id: string
  champion_team_id: string | null
  runner_up_team_id: string | null
  golden_boot_player: string | null
  champion_points: number
  runner_up_points: number
  golden_boot_points: number
  locked: boolean
  // joined
  champion_team?: Team
  runner_up_team?: Team
}

export interface League {
  id: string
  name: string
  description: string | null
  invite_code: string
  commissioner_id: string
  max_members: number
  is_public: boolean
  created_at: string
  // joined
  member_count?: number
}

export interface LeagueScore {
  league_id: string
  user_id: string
  total_points: number
  correct_results: number
  exact_scores: number
  picks_made: number
  rank: number
  rank_change: number
  updated_at: string
  // joined
  profile?: Profile
}

export interface GlobalScore {
  user_id: string
  total_points: number
  correct_results: number
  exact_scores: number
  picks_made: number
  global_rank: number
  // joined
  profile?: Profile
}

export interface ChatMessage {
  id: string
  league_id: string
  user_id: string
  content: string
  reaction_emoji: string | null
  created_at: string
  // joined
  profile?: Profile
}

export interface ScoringConfig {
  correct_result_pts: number
  exact_score_bonus: number
  champion_pts: number
  runner_up_pts: number
  golden_boot_pts: number
}

// Match with user's pick attached (for picks page)
export interface MatchWithPick extends Match {
  userPick?: Pick
  isLocked: boolean
}
