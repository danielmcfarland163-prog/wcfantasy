// =============================================
// BRACKET DATA & LOGIC — 2026 World Cup
// =============================================

export interface BracketTeam {
  n: string   // name
  f: string   // flag emoji
  c: string   // 3-letter code
}

export interface GroupData {
  name: string
  teams: BracketTeam[]
}

export interface BracketState {
  gp: Record<string, { first: string | null; second: string | null }>
  tp: Record<string, string | null>
  tq: string[]
  r32: (string | null)[]
  r16: (string | null)[]
  qf:  (string | null)[]
  sf:  (string | null)[]
  final: string | null
}

export const EMPTY_STATE: BracketState = {
  gp: {},
  tp: {},
  tq: [],
  r32: Array(16).fill(null),
  r16: Array(8).fill(null),
  qf:  Array(4).fill(null),
  sf:  Array(2).fill(null),
  final: null,
}

export const GROUPS: Record<string, GroupData> = {
  A: { name: 'A', teams: [{ n: 'Mexico', f: '🇲🇽', c: 'MEX' }, { n: 'South Korea', f: '🇰🇷', c: 'KOR' }, { n: 'South Africa', f: '🇿🇦', c: 'RSA' }, { n: 'Czechia', f: '🇨🇿', c: 'CZE' }] },
  B: { name: 'B', teams: [{ n: 'Canada', f: '🇨🇦', c: 'CAN' }, { n: 'Switzerland', f: '🇨🇭', c: 'SUI' }, { n: 'Qatar', f: '🇶🇦', c: 'QAT' }, { n: 'Bosnia & Herz.', f: '🇧🇦', c: 'BIH' }] },
  C: { name: 'C', teams: [{ n: 'Brazil', f: '🇧🇷', c: 'BRA' }, { n: 'Morocco', f: '🇲🇦', c: 'MAR' }, { n: 'Haiti', f: '🇭🇹', c: 'HAI' }, { n: 'Scotland', f: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', c: 'SCO' }] },
  D: { name: 'D', teams: [{ n: 'USA', f: '🇺🇸', c: 'USA' }, { n: 'Paraguay', f: '🇵🇾', c: 'PAR' }, { n: 'Australia', f: '🇦🇺', c: 'AUS' }, { n: 'Türkiye', f: '🇹🇷', c: 'TUR' }] },
  E: { name: 'E', teams: [{ n: 'Germany', f: '🇩🇪', c: 'GER' }, { n: 'Curaçao', f: '🇨🇼', c: 'CUW' }, { n: 'Ivory Coast', f: '🇨🇮', c: 'CIV' }, { n: 'Ecuador', f: '🇪🇨', c: 'ECU' }] },
  F: { name: 'F', teams: [{ n: 'Netherlands', f: '🇳🇱', c: 'NED' }, { n: 'Japan', f: '🇯🇵', c: 'JPN' }, { n: 'Sweden', f: '🇸🇪', c: 'SWE' }, { n: 'Tunisia', f: '🇹🇳', c: 'TUN' }] },
  G: { name: 'G', teams: [{ n: 'Belgium', f: '🇧🇪', c: 'BEL' }, { n: 'Egypt', f: '🇪🇬', c: 'EGY' }, { n: 'Iran', f: '🇮🇷', c: 'IRN' }, { n: 'New Zealand', f: '🇳🇿', c: 'NZL' }] },
  H: { name: 'H', teams: [{ n: 'Spain', f: '🇪🇸', c: 'ESP' }, { n: 'Cape Verde', f: '🇨🇻', c: 'CPV' }, { n: 'Saudi Arabia', f: '🇸🇦', c: 'KSA' }, { n: 'Uruguay', f: '🇺🇾', c: 'URU' }] },
  I: { name: 'I', teams: [{ n: 'France', f: '🇫🇷', c: 'FRA' }, { n: 'Senegal', f: '🇸🇳', c: 'SEN' }, { n: 'Iraq', f: '🇮🇶', c: 'IRQ' }, { n: 'Norway', f: '🇳🇴', c: 'NOR' }] },
  J: { name: 'J', teams: [{ n: 'Argentina', f: '🇦🇷', c: 'ARG' }, { n: 'Algeria', f: '🇩🇿', c: 'ALG' }, { n: 'Austria', f: '🇦🇹', c: 'AUT' }, { n: 'Jordan', f: '🇯🇴', c: 'JOR' }] },
  K: { name: 'K', teams: [{ n: 'Portugal', f: '🇵🇹', c: 'POR' }, { n: 'DR Congo', f: '🇨🇩', c: 'COD' }, { n: 'Uzbekistan', f: '🇺🇿', c: 'UZB' }, { n: 'Colombia', f: '🇨🇴', c: 'COL' }] },
  L: { name: 'L', teams: [{ n: 'England', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', c: 'ENG' }, { n: 'Croatia', f: '🇭🇷', c: 'CRO' }, { n: 'Ghana', f: '🇬🇭', c: 'GHA' }, { n: 'Panama', f: '🇵🇦', c: 'PAN' }] },
}

export const GROUP_KEYS = ['A','B','C','D','E','F','G','H','I','J','K','L'] as const

type R32Side = { g: string; r: number; t?: never } | { t: number; g?: never; r?: never }
type R32Fixture = { h: R32Side; a: R32Side }

// R32 matchups: each slot is {h: group+rank source, a: group+rank source}
// Last 4 slots (12-15) are for 3rd-place qualifiers
export const R32_FIXTURES: R32Fixture[] = [
  { h: { g: 'A', r: 1 }, a: { g: 'B', r: 2 } },
  { h: { g: 'B', r: 1 }, a: { g: 'A', r: 2 } },
  { h: { g: 'C', r: 1 }, a: { g: 'D', r: 2 } },
  { h: { g: 'D', r: 1 }, a: { g: 'C', r: 2 } },
  { h: { g: 'E', r: 1 }, a: { g: 'F', r: 2 } },
  { h: { g: 'F', r: 1 }, a: { g: 'E', r: 2 } },
  { h: { g: 'G', r: 1 }, a: { g: 'H', r: 2 } },
  { h: { g: 'H', r: 1 }, a: { g: 'G', r: 2 } },
  { h: { g: 'I', r: 1 }, a: { g: 'J', r: 2 } },
  { h: { g: 'J', r: 1 }, a: { g: 'I', r: 2 } },
  { h: { g: 'K', r: 1 }, a: { g: 'L', r: 2 } },
  { h: { g: 'L', r: 1 }, a: { g: 'K', r: 2 } },
  { h: { t: 0 }, a: { t: 7 } },
  { h: { t: 1 }, a: { t: 6 } },
  { h: { t: 2 }, a: { t: 5 } },
  { h: { t: 3 }, a: { t: 4 } },
]

// Which R32 slots feed each R16/QF/SF match
export const FLOW = {
  r16: [[0,1],[2,3],[4,5],[6,7],[8,9],[10,11],[12,13],[14,15]],
  qf:  [[0,1],[2,3],[4,5],[6,7]],
  sf:  [[0,1],[2,3]],
}

// Tournament lock time — picks freeze when the first match kicks off.
// Configurable via NEXT_PUBLIC_BRACKET_LOCK (ISO 8601, UTC); defaults to the
// 2026 World Cup opener. NEXT_PUBLIC_ so both server and client read the same value.
const LOCK_ISO = process.env.NEXT_PUBLIC_BRACKET_LOCK || '2026-06-11T15:00:00Z'
export const TOURNAMENT_LOCK = new Date(LOCK_ISO)

export function isLocked(): boolean {
  return new Date() >= TOURNAMENT_LOCK
}

// ── TEAM HELPERS ──────────────────────────────────────────────────────────────

export function teamByName(n: string): BracketTeam {
  for (const gk of GROUP_KEYS) {
    const t = GROUPS[gk].teams.find(t => t.n === n)
    if (t) return t
  }
  return { n, f: '🌍', c: n.slice(0, 3).toUpperCase() }
}

export function groupTeam(state: BracketState, g: string, rank: 1 | 2): BracketTeam | null {
  const p = state.gp[g]
  if (!p) return null
  const nm = rank === 1 ? p.first : p.second
  if (!nm) return null
  return GROUPS[g]?.teams.find(t => t.n === nm) ?? null
}

export function r32Teams(state: BracketState, i: number): { h: BracketTeam | null; a: BracketTeam | null } {
  const fixture = R32_FIXTURES[i]
  let h: BracketTeam | null = null
  let a: BracketTeam | null = null

  if ('g' in fixture.h) {
    h = groupTeam(state, fixture.h.g!, fixture.h.r as 1 | 2)
  } else {
    const nm = state.tq[fixture.h.t!]
    if (nm) h = teamByName(nm)
  }

  if ('g' in fixture.a) {
    a = groupTeam(state, fixture.a.g!, fixture.a.r as 1 | 2)
  } else {
    const nm = state.tq[fixture.a.t!]
    if (nm) a = teamByName(nm)
  }

  return { h, a }
}

export function getMatchTeams(
  state: BracketState,
  round: string,
  i: number
): { h: BracketTeam | null; a: BracketTeam | null } {
  if (round === 'r32') return r32Teams(state, i)

  if (round === 'final') {
    return {
      h: state.sf[0] ? teamByName(state.sf[0]) : null,
      a: state.sf[1] ? teamByName(state.sf[1]) : null,
    }
  }

  const srcRound = round === 'r16' ? 'r32' : round === 'qf' ? 'r16' : 'qf'
  const flowKey = round as 'r16' | 'qf' | 'sf'
  const [hIdx, aIdx] = FLOW[flowKey][i]

  const srcPicks = srcRound === 'r32' ? state.r32
    : srcRound === 'r16' ? state.r16
    : state.qf

  const hNm = srcPicks[hIdx]
  const aNm = srcPicks[aIdx]

  return {
    h: hNm ? teamByName(hNm) : null,
    a: aNm ? teamByName(aNm) : null,
  }
}

// ── PICK LOGIC ────────────────────────────────────────────────────────────────

export function setPick(state: BracketState, round: string, i: number, nm: string): BracketState {
  const s = { ...state, r32: [...state.r32], r16: [...state.r16], qf: [...state.qf], sf: [...state.sf] }

  if (round === 'final') {
    return { ...s, final: nm }
  }

  if (round === 'r32') {
    s.r32[i] = nm
    const ri = Math.floor(i / 2); s.r16[ri] = null
    const qi = Math.floor(ri / 2); s.qf[qi] = null
    const si = Math.floor(qi / 2); s.sf[si] = null; s.final = null
  } else if (round === 'r16') {
    s.r16[i] = nm
    const qi = Math.floor(i / 2); s.qf[qi] = null
    const si = Math.floor(qi / 2); s.sf[si] = null; s.final = null
  } else if (round === 'qf') {
    s.qf[i] = nm
    const si = Math.floor(i / 2); s.sf[si] = null; s.final = null
  } else if (round === 'sf') {
    s.sf[i] = nm; s.final = null
  }

  return s
}

export function pickGroup(state: BracketState, gk: string, nm: string): BracketState {
  const gp = { ...state.gp, [gk]: { ...(state.gp[gk] ?? {}) } }
  const p = gp[gk] as { first: string | null; second: string | null }

  if (p.first === nm) {
    p.first = p.second ?? null; p.second = null
  } else if (p.second === nm) {
    p.second = null
  } else if (!p.first) {
    p.first = nm
  } else if (!p.second) {
    p.second = nm
  } else {
    p.second = nm
  }

  // cascade clear bracket
  return {
    ...state,
    gp,
    r32: Array(16).fill(null),
    r16: Array(8).fill(null),
    qf:  Array(4).fill(null),
    sf:  Array(2).fill(null),
    final: null,
  }
}

export function thirdCandidates(state: BracketState, gk: string): BracketTeam[] {
  const p = state.gp[gk] ?? {}
  return GROUPS[gk].teams.filter(t => t.n !== p.first && t.n !== p.second)
}

export function pickThird(state: BracketState, gk: string, nm: string): BracketState {
  const tp = { ...state.tp }
  let tq = [...state.tq]
  const cur = tp[gk]

  if (cur === nm) {
    // toggle qualify
    if (tq.includes(nm)) {
      tq = tq.filter(x => x !== nm)
    } else if (tq.length < 8) {
      tq.push(nm)
    } else {
      return state // already 8, ignore
    }
  } else {
    if (cur) tq = tq.filter(x => x !== cur)
    tp[gk] = nm
    if (tq.length < 8) tq.push(nm)
  }

  // cascade clear bracket slots that depend on 3rd place (slots 12-15 + downstream)
  const r32 = [...state.r32]
  for (let i = 12; i < 16; i++) r32[i] = null
  const r16 = state.r16.map((v, i) => (i >= 6 ? null : v))
  const qf  = state.qf.map((v, i) => (i >= 3 ? null : v))

  return { ...state, tp, tq, r32, r16, qf, sf: [null, null], final: null }
}

export function groupsComplete(state: BracketState): boolean {
  return GROUP_KEYS.every(gk => {
    const p = state.gp[gk]
    return p?.first && p?.second
  })
}

export function thirdComplete(state: BracketState): boolean {
  return state.tq.length === 8
}

// Serialize state to DB-friendly JSON
export function stateToDb(s: BracketState) {
  return {
    group_picks: s.gp,
    third_picks: s.tp,
    third_quals: s.tq,
    r32_picks:   s.r32,
    r16_picks:   s.r16,
    qf_picks:    s.qf,
    sf_picks:    s.sf,
    final_pick:  s.final,
  }
}

// Deserialize from DB
export function dbToState(row: any): BracketState {
  return {
    gp:    row?.group_picks ?? {},
    tp:    row?.third_picks ?? {},
    tq:    row?.third_quals ?? [],
    r32:   row?.r32_picks ?? Array(16).fill(null),
    r16:   row?.r16_picks ?? Array(8).fill(null),
    qf:    row?.qf_picks  ?? Array(4).fill(null),
    sf:    row?.sf_picks  ?? Array(2).fill(null),
    final: row?.final_pick ?? null,
  }
}
