// =============================================
// BRACKET DATA & LOGIC — Tournament
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

// ── PHASED LOCKS ──────────────────────────────────────────────────────────────
// The bracket is filled in two phases:
//   Phase 1 — GROUP picks (1st/2nd + 3rd-place qualifiers). Freeze at the first
//             match kickoff (the group lock).
//   Phase 2 — KNOCKOUT bracket. Opens once the real group stage is over (results
//             known) and freezes when the Round of 32 kicks off (the knockout lock).
// Both are configurable via NEXT_PUBLIC_* env vars (ISO 8601, UTC) so server and
// client read the same value; defaults track the real 2026 schedule.

const GROUP_LOCK_ISO = process.env.NEXT_PUBLIC_BRACKET_LOCK || '2026-06-11T15:00:00Z'
// TOURNAMENT_LOCK is kept as the name for the GROUP-phase lock (back-compat).
export const TOURNAMENT_LOCK = new Date(GROUP_LOCK_ISO)
export const GROUP_LOCK = TOURNAMENT_LOCK

const KNOCKOUT_LOCK_ISO = process.env.NEXT_PUBLIC_KNOCKOUT_LOCK || '2026-06-28T19:00:00Z'
export const KNOCKOUT_LOCK = new Date(KNOCKOUT_LOCK_ISO)

// Back-compat: isLocked() === the group-phase lock.
export function isLocked(): boolean {
  return new Date() >= GROUP_LOCK
}
export function isGroupLocked(): boolean {
  return new Date() >= GROUP_LOCK
}
export function isKnockoutLocked(): boolean {
  return new Date() >= KNOCKOUT_LOCK
}

// Loose shape of tournament_results that the phased helpers need.
export interface BracketResults {
  group_results?: Record<string, { first: string | null; second: string | null; third: string | null }> | null
  third_quals?: (string | null)[] | null
  r32_results?: (string | null)[] | null
  r16_results?: (string | null)[] | null
  qf_results?: (string | null)[] | null
  sf_results?: (string | null)[] | null
  final_result?: string | null
}

// The group stage is "over" (and the knockout bracket can open) once every group
// has a 1st & 2nd and the 8 third-place qualifiers are known — i.e. the actual
// Round of 32 field is fully determined.
export function groupResultsComplete(results?: BracketResults | null): boolean {
  if (!results) return false
  const gr = results.group_results ?? {}
  const allGroups = GROUP_KEYS.every((gk) => gr[gk]?.first && gr[gk]?.second)
  const thirdsKnown = (results.third_quals ?? []).filter(Boolean).length >= 8
  return allGroups && thirdsKnown
}

// The 16 actual R32 fixtures, seeded from real results. Slot order mirrors
// R32_FIXTURES (and derive-results' r32Pairs), so indices line up with both the
// user's r32 picks and tournament_results.r32_results.
export function knockoutFixturesFromResults(
  results?: BracketResults | null,
): { h: BracketTeam | null; a: BracketTeam | null }[] {
  const gr = results?.group_results ?? {}
  const tq = results?.third_quals ?? []
  const g = (k: string, slot: 'first' | 'second') => gr[k]?.[slot] ?? null
  const pairs: [string | null, string | null][] = [
    [g('A', 'first'), g('B', 'second')], [g('B', 'first'), g('A', 'second')],
    [g('C', 'first'), g('D', 'second')], [g('D', 'first'), g('C', 'second')],
    [g('E', 'first'), g('F', 'second')], [g('F', 'first'), g('E', 'second')],
    [g('G', 'first'), g('H', 'second')], [g('H', 'first'), g('G', 'second')],
    [g('I', 'first'), g('J', 'second')], [g('J', 'first'), g('I', 'second')],
    [g('K', 'first'), g('L', 'second')], [g('L', 'first'), g('K', 'second')],
    [tq[0] ?? null, tq[7] ?? null], [tq[1] ?? null, tq[6] ?? null],
    [tq[2] ?? null, tq[5] ?? null], [tq[3] ?? null, tq[4] ?? null],
  ]
  return pairs.map(([a, b]) => ({
    h: a ? teamByName(a) : null,
    a: b ? teamByName(b) : null,
  }))
}

// Match participants for the KNOCKOUT phase. The R32 base layer comes from the
// ACTUAL results (everyone fills the same real bracket); R16→Final flow from the
// user's own winner picks exactly as before.
export function getKnockoutMatchTeams(
  state: BracketState,
  results: BracketResults | null | undefined,
  round: string,
  i: number,
): { h: BracketTeam | null; a: BracketTeam | null } {
  if (round === 'r32') return knockoutFixturesFromResults(results)[i] ?? { h: null, a: null }
  return getMatchTeams(state, round, i)
}

// When the knockout phase opens, a user's stored knockout picks may reference
// teams that didn't actually qualify (their old picks were seeded off their own
// predicted groups). Drop any pick that isn't a real participant of its slot, and
// cascade-clear downstream rounds that are no longer reachable. Non-destructive
// for valid picks; returns the cleaned state.
export function reconcileKnockout(
  state: BracketState,
  results: BracketResults | null | undefined,
): BracketState {
  const fixtures = knockoutFixturesFromResults(results)
  const r32 = state.r32.map((pick, i) => {
    const f = fixtures[i]
    return pick && (f?.h?.n === pick || f?.a?.n === pick) ? pick : null
  })
  let s: BracketState = { ...state, r32 }

  const validateRound = (picks: (string | null)[], round: string) =>
    picks.map((pick, i) => {
      if (!pick) return null
      const { h, a } = getMatchTeams(s, round, i)
      return h?.n === pick || a?.n === pick ? pick : null
    })

  s = { ...s, r16: validateRound(state.r16, 'r16') }
  s = { ...s, qf: validateRound(state.qf, 'qf') }
  s = { ...s, sf: validateRound(state.sf, 'sf') }

  let final = state.final
  if (final) {
    const { h, a } = getMatchTeams(s, 'final', 0)
    if (h?.n !== final && a?.n !== final) final = null
  }
  return { ...s, final }
}

export function knockoutComplete(state: BracketState): boolean {
  return !!state.final
}

// ── BRACKET MODES ─────────────────────────────────────────────────────────────
// Two independent bracket games:
//   pickem  Up-Front Pick'em — whole bracket filled before the tournament; the
//           knockout is seeded from the player's OWN predicted groups; everything
//           locks at the group lock (first kickoff).
//   reset   Bracket Reset — group + 3rd lock at the group lock, then the knockout
//           re-opens seeded from the ACTUAL results and locks at the knockout lock.

export type BracketMode = 'pickem' | 'reset'

export const BRACKET_MODES: { key: BracketMode; label: string; blurb: string }[] = [
  { key: 'pickem', label: 'Up-Front Pick’em', blurb: 'Fill the whole bracket before kickoff · locks Jun 11' },
  { key: 'reset',  label: 'Bracket Reset',          blurb: 'Knockout re-opens from the real R32 after groups · locks Jun 28' },
]

// Is the knockout portion of this mode available to fill yet?
//   pickem → as soon as the player's own group picks are complete (self-seeded).
//   reset  → only once the real group stage is over (actual R32 known).
export function bracketModeOpen(
  mode: BracketMode,
  state: BracketState,
  results?: BracketResults | null,
): boolean {
  return mode === 'pickem' ? groupsComplete(state) : groupResultsComplete(results)
}

// When does this mode's knockout freeze?
//   pickem → the group lock (single up-front lock).
//   reset  → the knockout lock.
export function bracketModeLock(mode: BracketMode): Date {
  return mode === 'pickem' ? GROUP_LOCK : KNOCKOUT_LOCK
}

export function isBracketModeLocked(mode: BracketMode): boolean {
  return new Date() >= bracketModeLock(mode)
}

// Match participants for a mode's knockout round.
//   pickem → seeded from the player's own group picks (classic).
//   reset  → seeded from the actual results (everyone shares the real R32).
export function getModeMatchTeams(
  mode: BracketMode,
  state: BracketState,
  results: BracketResults | null | undefined,
  round: string,
  i: number,
): { h: BracketTeam | null; a: BracketTeam | null } {
  return mode === 'pickem'
    ? getMatchTeams(state, round, i)
    : getKnockoutMatchTeams(state, results, round, i)
}

// ── PICK'EM SURVIVOR POOL ───────────────────────────────────────────────────────
// Pick'em is a survivor pool, not a matchup bracket: you pick WHICH teams advance
// each round, independent of who plays whom — so a missed group pick can never
// cascade through a fixed bracket of matchups. Selection narrows your own pool:
//   32 qualifiers → 16 (reach R16) → 8 (QF) → 4 (SF) → 2 (Final) → 1 champion.
// Stored in the same r32/r16/qf/sf/final columns, but as SETS; scored by membership
// (lib/bracket-scoring.ts, mode 'pickem').

export type SurvivorRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final'

export const SURVIVOR_COUNTS: Record<SurvivorRound, number> = {
  r32: 16, r16: 8, qf: 4, sf: 2, final: 1,
}

function compact(a: (string | null)[] | null | undefined): string[] {
  return (a ?? []).filter(Boolean) as string[]
}
function padTo(a: string[], n: number): (string | null)[] {
  const out: (string | null)[] = a.slice(0, n)
  while (out.length < n) out.push(null)
  return out
}

// The 32 teams a user has placed into the knockout: 1st + 2nd of all 12 groups plus
// their 8 third-place qualifiers. De-duplicated, in a stable display order
// (winners, then runners-up, then thirds).
export function pool32(state: BracketState): string[] {
  const firsts: string[] = []
  const seconds: string[] = []
  for (const gk of GROUP_KEYS) {
    const p = state.gp[gk]
    if (p?.first) firsts.push(p.first)
    if (p?.second) seconds.push(p.second)
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const n of [...firsts, ...seconds, ...compact(state.tq)]) {
    if (!seen.has(n)) { seen.add(n); out.push(n) }
  }
  return out
}

// Names a pickem round can be filled from: the previous round's chosen set
// (r32 draws from the full pool of 32).
export function survivorCandidates(state: BracketState, round: SurvivorRound): string[] {
  switch (round) {
    case 'r32': return pool32(state)
    case 'r16': return compact(state.r32)
    case 'qf':  return compact(state.r16)
    case 'sf':  return compact(state.qf)
    case 'final': return compact(state.sf)
  }
}

export function survivorPicks(state: BracketState, round: SurvivorRound): string[] {
  switch (round) {
    case 'final': return state.final ? [state.final] : []
    case 'r32': return compact(state.r32)
    case 'r16': return compact(state.r16)
    case 'qf':  return compact(state.qf)
    case 'sf':  return compact(state.sf)
  }
}

// Re-validate the survivor sets after any change: each round stays a subset of the
// round above it (and the pool), capped at its count. Prunes invalid picks and
// cascades the pruning downward — this is membership integrity, NOT a matchup
// cascade. Swapping a group's 1st/2nd (same two teams) leaves every pick intact.
export function prunePickemSurvivors(state: BracketState): BracketState {
  const inPool = new Set(pool32(state))
  const r32 = compact(state.r32).filter(n => inPool.has(n)).slice(0, SURVIVOR_COUNTS.r32)
  const r32Set = new Set(r32)
  const r16 = compact(state.r16).filter(n => r32Set.has(n)).slice(0, SURVIVOR_COUNTS.r16)
  const r16Set = new Set(r16)
  const qf = compact(state.qf).filter(n => r16Set.has(n)).slice(0, SURVIVOR_COUNTS.qf)
  const qfSet = new Set(qf)
  const sf = compact(state.sf).filter(n => qfSet.has(n)).slice(0, SURVIVOR_COUNTS.sf)
  const sfSet = new Set(sf)
  const final = state.final && sfSet.has(state.final) ? state.final : null
  return {
    ...state,
    r32: padTo(r32, SURVIVOR_COUNTS.r32),
    r16: padTo(r16, SURVIVOR_COUNTS.r16),
    qf: padTo(qf, SURVIVOR_COUNTS.qf),
    sf: padTo(sf, SURVIVOR_COUNTS.sf),
    final,
  }
}

// Toggle a team into / out of a pickem survivor round. Enforces the round's cap and
// the subset rule; deselecting cascades the removal to deeper rounds. Final replaces.
export function toggleSurvivor(state: BracketState, round: SurvivorRound, nm: string): BracketState {
  const cap = SURVIVOR_COUNTS[round]
  const cur = survivorPicks(state, round)
  let next: string[]
  if (cur.includes(nm)) next = cur.filter(x => x !== nm)
  else if (cur.length < cap) next = [...cur, nm]
  else if (cap === 1) next = [nm]
  else return state // at cap, ignore

  let s: BracketState
  if (round === 'final') s = { ...state, final: next[0] ?? null }
  else if (round === 'r32') s = { ...state, r32: padTo(next, cap) }
  else if (round === 'r16') s = { ...state, r16: padTo(next, cap) }
  else if (round === 'qf')  s = { ...state, qf: padTo(next, cap) }
  else                      s = { ...state, sf: padTo(next, cap) }
  return prunePickemSurvivors(s)
}

// A pickem bracket is complete only when every round is filled to its cap
// (16 / 8 / 4 / 2 / 1) — reaching a champion via a thin chain is allowed but not
// "done", so the UI keeps prompting for the remaining picks.
export function survivorComplete(state: BracketState): boolean {
  return compact(state.r32).length === SURVIVOR_COUNTS.r32
    && compact(state.r16).length === SURVIVOR_COUNTS.r16
    && compact(state.qf).length === SURVIVOR_COUNTS.qf
    && compact(state.sf).length === SURVIVOR_COUNTS.sf
    && !!state.final
}

// Pick'em group / 3rd-place handlers — same selection behaviour as pickGroup /
// pickThird, but they re-validate the survivor sets instead of WIPING the knockout
// (the matchup-seeded reset behaviour), so editing a group only drops picks that
// genuinely left your pool of 32.
export function pickGroupPickem(state: BracketState, gk: string, nm: string): BracketState {
  const gp = { ...state.gp, [gk]: { ...(state.gp[gk] ?? { first: null, second: null }) } }
  const p = gp[gk] as { first: string | null; second: string | null }
  if (p.first === nm) { p.first = p.second ?? null; p.second = null }
  else if (p.second === nm) { p.second = null }
  else if (!p.first) p.first = nm
  else if (!p.second) p.second = nm
  else p.second = nm
  return prunePickemSurvivors({ ...state, gp })
}

export function pickThirdPickem(state: BracketState, gk: string, nm: string): BracketState {
  const tp = { ...state.tp }
  let tq = [...state.tq]
  const cur = tp[gk]
  if (cur === nm) {
    if (tq.includes(nm)) tq = tq.filter(x => x !== nm)
    else if (tq.length < 8) tq.push(nm)
    else return state
  } else {
    if (cur) tq = tq.filter(x => x !== cur)
    tp[gk] = nm
    if (tq.length < 8) tq.push(nm)
  }
  return prunePickemSurvivors({ ...state, tp, tq })
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
