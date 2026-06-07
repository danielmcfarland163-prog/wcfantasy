// =============================================
// SOCCER FANTASY GAME — SHARED TYPES
// =============================================

export type MatchStage = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL'
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED'
export type WinnerPick = 'HOME' | 'DRAW' | 'AWAY'
export type PickResult = 'EXACT' | 'CORRECT' | 'WRONG'
export type ConfidenceMultiplier = 1 | 2 | 3

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
  // Scoreline prediction (My Picks core model)
  home_score_pick: number
  away_score_pick: number
  confidence_multiplier: ConfidenceMultiplier
  // Derived winner (kept for back-compat / convenience; computed from the scoreline on save)
  winner_pick?: WinnerPick | null
  points_earned: number | null
  pick_result: PickResult | null
  scored_at: string | null
  created_at: string
  updated_at?: string | null
  // joined
  match?: Match
}

export interface TournamentPick {
  id: string
  user_id: string
  champion_team_id: string | null
  runner_up_team_id: string | null
  golden_boot_player: string | null
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

export interface BracketEntry {
  user_id: string
  group_picks: Record<string, { first: string | null; second: string | null }>
  third_picks: Record<string, string | null>
  third_quals: string[]
  r32_picks: (string | null)[]
  r16_picks: (string | null)[]
  qf_picks: (string | null)[]
  sf_picks: (string | null)[]
  final_pick: string | null
  locked: boolean
  updated_at: string
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
