// Compute live group-stage standings from match rows.
// Pure + dependency-free so it can run on the server (Stats page) or be unit-tested.
// Tiebreakers mirror the simulate route: points, then goal difference, then goals for.

export interface StandingRow {
  teamId: string
  name: string
  code: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  pts: number
}

interface TeamRef {
  id: string
  name: string
  short_code: string
}

export interface StandingsMatch {
  group_letter: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  home_team: TeamRef | null
  away_team: TeamRef | null
}

export function computeGroupStandings(
  matches: StandingsMatch[],
): Record<string, StandingRow[]> {
  const groups: Record<string, Map<string, StandingRow>> = {}

  const ensure = (g: string, team: TeamRef): StandingRow => {
    if (!groups[g]) groups[g] = new Map()
    const map = groups[g]
    let row = map.get(team.id)
    if (!row) {
      row = {
        teamId: team.id,
        name: team.name,
        code: (team.short_code ?? '').trim(),
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      }
      map.set(team.id, row)
    }
    return row
  }

  for (const m of matches) {
    const g = m.group_letter
    if (!g || !m.home_team || !m.away_team) continue

    // Register both teams up front so all four show even before any match is played.
    const home = ensure(g, m.home_team)
    const away = ensure(g, m.away_team)

    const finished = m.status === 'FINISHED' && m.home_score != null && m.away_score != null
    if (!finished) continue

    const hs = m.home_score as number
    const as_ = m.away_score as number
    home.played++; away.played++
    home.gf += hs; home.ga += as_
    away.gf += as_; away.ga += hs

    if (hs > as_)      { home.won++;  home.pts += 3; away.lost++ }
    else if (hs < as_) { away.won++;  away.pts += 3; home.lost++ }
    else               { home.drawn++; away.drawn++; home.pts++; away.pts++ }
  }

  const out: Record<string, StandingRow[]> = {}
  for (const [g, map] of Object.entries(groups)) {
    const rows = [...map.values()]
    for (const r of rows) r.gd = r.gf - r.ga
    rows.sort((a, b) =>
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name),
    )
    out[g] = rows
  }
  return out
}
