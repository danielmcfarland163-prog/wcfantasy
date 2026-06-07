// POST /api/seed-teams — seeds all 48 teams + creates tournament_results row
// Auth: CRON_SECRET OR an admin session (the /admin "Seed teams" button).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { isCronOrAdmin } from '@/lib/api-auth'

const TEAMS = [
  { name: 'Mexico',         short_code: 'MEX', group_letter: 'A', flag_emoji: '🇲🇽' },
  { name: 'South Korea',    short_code: 'KOR', group_letter: 'A', flag_emoji: '🇰🇷' },
  { name: 'South Africa',   short_code: 'RSA', group_letter: 'A', flag_emoji: '🇿🇦' },
  { name: 'Czechia',        short_code: 'CZE', group_letter: 'A', flag_emoji: '🇨🇿' },
  { name: 'Canada',         short_code: 'CAN', group_letter: 'B', flag_emoji: '🇨🇦' },
  { name: 'Switzerland',    short_code: 'SUI', group_letter: 'B', flag_emoji: '🇨🇭' },
  { name: 'Qatar',          short_code: 'QAT', group_letter: 'B', flag_emoji: '🇶🇦' },
  { name: 'Bosnia & Herz.', short_code: 'BIH', group_letter: 'B', flag_emoji: '🇧🇦' },
  { name: 'Brazil',         short_code: 'BRA', group_letter: 'C', flag_emoji: '🇧🇷' },
  { name: 'Morocco',        short_code: 'MAR', group_letter: 'C', flag_emoji: '🇲🇦' },
  { name: 'Haiti',          short_code: 'HAI', group_letter: 'C', flag_emoji: '🇭🇹' },
  { name: 'Scotland',       short_code: 'SCO', group_letter: 'C', flag_emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'USA',            short_code: 'USA', group_letter: 'D', flag_emoji: '🇺🇸' },
  { name: 'Paraguay',       short_code: 'PAR', group_letter: 'D', flag_emoji: '🇵🇾' },
  { name: 'Australia',      short_code: 'AUS', group_letter: 'D', flag_emoji: '🇦🇺' },
  { name: 'Türkiye',        short_code: 'TUR', group_letter: 'D', flag_emoji: '🇹🇷' },
  { name: 'Germany',        short_code: 'GER', group_letter: 'E', flag_emoji: '🇩🇪' },
  { name: 'Curaçao',        short_code: 'CUW', group_letter: 'E', flag_emoji: '🇨🇼' },
  { name: 'Ivory Coast',    short_code: 'CIV', group_letter: 'E', flag_emoji: '🇨🇮' },
  { name: 'Ecuador',        short_code: 'ECU', group_letter: 'E', flag_emoji: '🇪🇨' },
  { name: 'Netherlands',    short_code: 'NED', group_letter: 'F', flag_emoji: '🇳🇱' },
  { name: 'Japan',          short_code: 'JPN', group_letter: 'F', flag_emoji: '🇯🇵' },
  { name: 'Sweden',         short_code: 'SWE', group_letter: 'F', flag_emoji: '🇸🇪' },
  { name: 'Tunisia',        short_code: 'TUN', group_letter: 'F', flag_emoji: '🇹🇳' },
  { name: 'Belgium',        short_code: 'BEL', group_letter: 'G', flag_emoji: '🇧🇪' },
  { name: 'Egypt',          short_code: 'EGY', group_letter: 'G', flag_emoji: '🇪🇬' },
  { name: 'Iran',           short_code: 'IRN', group_letter: 'G', flag_emoji: '🇮🇷' },
  { name: 'New Zealand',    short_code: 'NZL', group_letter: 'G', flag_emoji: '🇳🇿' },
  { name: 'Spain',          short_code: 'ESP', group_letter: 'H', flag_emoji: '🇪🇸' },
  { name: 'Cape Verde',     short_code: 'CPV', group_letter: 'H', flag_emoji: '🇨🇻' },
  { name: 'Saudi Arabia',   short_code: 'KSA', group_letter: 'H', flag_emoji: '🇸🇦' },
  { name: 'Uruguay',        short_code: 'URY', group_letter: 'H', flag_emoji: '🇺🇾' },
  { name: 'France',         short_code: 'FRA', group_letter: 'I', flag_emoji: '🇫🇷' },
  { name: 'Senegal',        short_code: 'SEN', group_letter: 'I', flag_emoji: '🇸🇳' },
  { name: 'Iraq',           short_code: 'IRQ', group_letter: 'I', flag_emoji: '🇮🇶' },
  { name: 'Norway',         short_code: 'NOR', group_letter: 'I', flag_emoji: '🇳🇴' },
  { name: 'Argentina',      short_code: 'ARG', group_letter: 'J', flag_emoji: '🇦🇷' },
  { name: 'Algeria',        short_code: 'ALG', group_letter: 'J', flag_emoji: '🇩🇿' },
  { name: 'Austria',        short_code: 'AUT', group_letter: 'J', flag_emoji: '🇦🇹' },
  { name: 'Jordan',         short_code: 'JOR', group_letter: 'J', flag_emoji: '🇯🇴' },
  { name: 'Portugal',       short_code: 'POR', group_letter: 'K', flag_emoji: '🇵🇹' },
  { name: 'DR Congo',       short_code: 'COD', group_letter: 'K', flag_emoji: '🇨🇩' },
  { name: 'Uzbekistan',     short_code: 'UZB', group_letter: 'K', flag_emoji: '🇺🇿' },
  { name: 'Colombia',       short_code: 'COL', group_letter: 'K', flag_emoji: '🇨🇴' },
  { name: 'England',        short_code: 'ENG', group_letter: 'L', flag_emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Croatia',        short_code: 'CRO', group_letter: 'L', flag_emoji: '🇭🇷' },
  { name: 'Ghana',          short_code: 'GHA', group_letter: 'L', flag_emoji: '🇬🇭' },
  { name: 'Panama',         short_code: 'PAN', group_letter: 'L', flag_emoji: '🇵🇦' },
]

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('teams')
    .upsert(TEAMS, { onConflict: 'short_code' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, teams: TEAMS.length })
}
