'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { formatKickoff } from '@/lib/utils'
import type { Match } from '@/lib/types'

// Prepend the basePath (e.g. /soccer-fantasy) so fetch calls work under Cloudflare's
// sub-path routing. Derived at runtime from the current URL to avoid hardcoding.
function apiPath(path: string) {
  const base = window.location.pathname.replace(/\/admin(\/.*)?$/, '')
  return base + path
}

type Tab = 'matches' | 'users' | 'leagues' | 'reset' | 'simulate'

export default function AdminClient({ initialMatches }: { initialMatches: Match[] }) {
  const [tab, setTab] = useState<Tab>('matches')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'matches',  label: 'Matches' },
    { key: 'users',    label: 'Users' },
    { key: 'leagues',  label: 'Leagues' },
    { key: 'reset',    label: 'Reset Picks' },
    { key: 'simulate', label: '🧪 Sim' },
  ]

  return (
    <div style={{ padding: '0 20px 40px' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 11, background: 'var(--surface-2)', marginBottom: 20 }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, border: 'none', cursor: 'pointer', padding: '8px 4px', borderRadius: 8,
            background: tab === key ? 'var(--surface)' : 'transparent',
            boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
            fontFamily: 'var(--f-body)', fontWeight: tab === key ? 700 : 600, fontSize: 13,
            color: tab === key ? 'var(--ink)' : 'var(--ink-3)', transition: 'all .15s',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'matches'  && <MatchesTab initialMatches={initialMatches} />}
      {tab === 'users'    && <UsersTab />}
      {tab === 'leagues'  && <LeaguesTab />}
      {tab === 'reset'    && <ResetTab />}
      {tab === 'simulate' && <SimulateTab />}
    </div>
  )
}

/* ── MATCHES TAB ─────────────────────────────────────────────── */
function MatchesTab({ initialMatches }: { initialMatches: Match[] }) {
  const supabase = createClient()
  const [matches, setMatches] = useState(initialMatches)
  const [editing, setEditing] = useState<string | null>(null)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function saveScore(id: string) {
    setSaving(true)
    const { error } = await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status: 'FINISHED' })
      .eq('id', id)
    if (!error) {
      setMatches(prev => prev.map(m => m.id === id ? { ...m, home_score: homeScore, away_score: awayScore, status: 'FINISHED' } : m))
      setEditing(null)
      setMsg('Score saved.')
    }
    setSaving(false)
  }

  async function triggerPickScoring() {
    setMsg('Scoring picks...')
    const res = await fetch(apiPath('/api/score-picks'))
    const d = await res.json()
    setMsg(d.scored ? `Scored ${d.scored} picks across ${d.users ?? 0} users.` : d.message ?? d.error ?? 'Done')
  }

  async function triggerScoring() {
    setMsg('Scoring brackets...')
    const res = await fetch(apiPath('/api/score-bracket'), { method: 'POST' })
    const d = await res.json()
    setMsg(d.ok ? `Scored ${d.scored} entries.` : d.error ?? 'Error')
  }

  async function syncScores() {
    setMsg('Syncing live scores...')
    const res = await fetch(apiPath('/api/sync-scores'))
    const d = await res.json()
    setMsg(d.synced != null ? `Synced ${d.synced} matches (${d.live ?? 0} live, ${d.finished ?? 0} finished).` : d.message ?? d.error ?? 'Done')
  }

  async function syncFixtures() {
    setMsg('Syncing fixtures (incl. knockouts)...')
    const res = await fetch(apiPath('/api/sync-fixtures'), { method: 'POST' })
    const d = await res.json()
    setMsg(d.upserted != null ? `Synced ${d.upserted} fixtures${d.skippedTBD ? ` (${d.skippedTBD} TBD skipped)` : ''}.` : d.message ?? d.error ?? 'Done')
  }

  async function seedTeams() {
    setMsg('Seeding teams...')
    const res = await fetch(apiPath('/api/seed-teams'), { method: 'POST' })
    const d = await res.json()
    setMsg(d.ok ? `Seeded ${d.teams} teams.` : d.error ?? 'Error')
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <button onClick={triggerPickScoring} style={actionBtn}>✅ Score picks</button>
        <button onClick={triggerScoring} style={actionBtn}>⚡ Score brackets</button>
        <button onClick={syncScores} style={actionBtn}>🔄 Sync live scores</button>
        <button onClick={syncFixtures} style={actionBtn}>📅 Sync fixtures</button>
        <button onClick={seedTeams} style={actionBtn}>🌍 Seed teams</button>
      </div>
      {msg && <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--win)', background: 'color-mix(in srgb, var(--win) 8%, transparent)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>{msg}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map(m => {
          const home = (m as any).home_team?.name ?? 'Home'
          const away = (m as any).away_team?.name ?? 'Away'
          const isEd = editing === m.id
          return (
            <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', flex: 1, minWidth: 120 }}>
                  {home} vs {away}
                </span>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{formatKickoff(m.kickoff_time)}</span>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: m.status === 'FINISHED' ? 'var(--win)' : m.status === 'LIVE' ? 'var(--live)' : 'var(--ink-3)' }}>
                  {m.status === 'FINISHED' ? `${m.home_score}-${m.away_score} FT` : m.status}
                </span>
                {!isEd && (
                  <button onClick={() => { setEditing(m.id); setHomeScore(m.home_score ?? 0); setAwayScore(m.away_score ?? 0) }} style={smallBtn}>
                    Edit score
                  </button>
                )}
              </div>
              {isEd && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <input type="number" min={0} value={homeScore} onChange={e => setHomeScore(+e.target.value)} style={{ ...scoreInput, width: 56 }} />
                  <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 18, color: 'var(--ink-3)' }}>—</span>
                  <input type="number" min={0} value={awayScore} onChange={e => setAwayScore(+e.target.value)} style={{ ...scoreInput, width: 56 }} />
                  <button onClick={() => saveScore(m.id)} disabled={saving} style={actionBtn}>{saving ? '...' : 'Save'}</button>
                  <button onClick={() => setEditing(null)} style={{ ...smallBtn, color: 'var(--ink-3)' }}>Cancel</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── USERS TAB ───────────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiPath('/api/admin/users'))
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
      if (!Array.isArray(data)) setMsg(data.error ?? 'Failed to load users')
    } catch (e) {
      setMsg('Network error loading users')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This is permanent.`)) return
    const res = await fetch(apiPath('/api/admin/users'), { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: id }) })
    const d = await res.json()
    if (d.ok) { setMsg(`Deleted ${name}`); load() }
    else setMsg(d.error ?? 'Error')
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch(apiPath('/api/admin/users'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword, username: newUsername }),
    })
    const d = await res.json()
    if (d.ok) {
      setMsg(`Created @${newUsername}`)
      setNewEmail(''); setNewPassword(''); setNewUsername(''); setShowAdd(false)
      load()
    } else {
      setMsg(d.error ?? 'Error')
    }
    setCreating(false)
  }

  if (loading) return <div style={loadingStyle}>Loading users…</div>

  return (
    <div>
      {msg && <div style={msgStyle}>{msg}</div>}

      {/* Add user panel */}
      <div style={{ marginBottom: 14 }}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} style={actionBtn}>+ Add user</button>
        ) : (
          <form onSubmit={createUser} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.8, color: 'var(--ink-3)', marginBottom: 2 }}>NEW USER</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="email" required placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input" style={{ flex: '1 1 160px', padding: '7px 10px', fontSize: 13 }} />
              <input type="text" required placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="input" style={{ flex: '1 1 120px', padding: '7px 10px', fontSize: 13 }} />
              <input type="password" required placeholder="Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input" style={{ flex: '1 1 120px', padding: '7px 10px', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={creating} style={actionBtn}>{creating ? 'Creating…' : 'Create'}</button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ ...smallBtn, color: 'var(--ink-3)' }}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
        {users.length === 0 && <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)' }}>No users yet.</div>}
        {users.map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 14, color: 'var(--ink-2)' }}>
              {(u.username ?? '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{u.display_name ?? u.username}</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)' }}>@{u.username} · {u.id.slice(0,8)}</div>
            </div>
            <button onClick={() => deleteUser(u.id, u.username)} style={{ ...smallBtn, color: 'var(--live)', borderColor: 'color-mix(in srgb, var(--live) 30%, var(--line))' }}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── LEAGUES TAB ─────────────────────────────────────────────── */
function LeaguesTab() {
  const [leagues, setLeagues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiPath('/api/admin/leagues'))
      const data = await res.json()
      setLeagues(Array.isArray(data) ? data : [])
      if (!Array.isArray(data)) setMsg(data.error ?? 'Failed to load leagues')
    } catch (e) {
      setMsg('Network error loading leagues')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteLeague(id: string, name: string) {
    if (!confirm(`Delete league "${name}"? Members and scores will be removed.`)) return
    const res = await fetch(apiPath('/api/admin/leagues'), { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leagueId: id }) })
    const d = await res.json()
    if (d.ok) { setMsg(`Deleted "${name}"`); load() }
    else setMsg(d.error ?? 'Error')
  }

  async function resetChat(id: string, name: string) {
    if (!confirm(`Clear all chat messages in "${name}"? This can't be undone.`)) return
    const res = await fetch(apiPath('/api/admin/reset-chat'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leagueId: id }) })
    const d = await res.json()
    setMsg(d.ok ? `Cleared ${d.deleted} message${d.deleted === 1 ? '' : 's'} from "${name}".` : d.error ?? 'Error')
  }

  async function createLeague(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch(apiPath('/api/admin/leagues'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc }),
    })
    const d = await res.json()
    if (d.ok) {
      setMsg(`Created "${newName}"`)
      setNewName(''); setNewDesc(''); setShowAdd(false)
      load()
    } else {
      setMsg(d.error ?? 'Error')
    }
    setCreating(false)
  }

  if (loading) return <div style={loadingStyle}>Loading leagues…</div>

  return (
    <div>
      {msg && <div style={msgStyle}>{msg}</div>}

      {/* Add league panel */}
      <div style={{ marginBottom: 14 }}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} style={actionBtn}>+ Create league</button>
        ) : (
          <form onSubmit={createLeague} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.8, color: 'var(--ink-3)', marginBottom: 2 }}>NEW LEAGUE</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" required placeholder="League name" value={newName} onChange={e => setNewName(e.target.value)} className="input" style={{ flex: '1 1 180px', padding: '7px 10px', fontSize: 13 }} />
              <input type="text" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="input" style={{ flex: '2 1 220px', padding: '7px 10px', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={creating} style={actionBtn}>{creating ? 'Creating…' : 'Create'}</button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ ...smallBtn, color: 'var(--ink-3)' }}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
        {leagues.length === 0 && <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)' }}>No leagues yet.</div>}
        {leagues.map((lg, i) => (
          <div key={lg.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{lg.name}</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                {lg.member_count?.[0]?.count ?? 0} members · CODE: {lg.invite_code}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => resetChat(lg.id, lg.name)} style={smallBtn}>
                Reset chat
              </button>
              <button onClick={() => deleteLeague(lg.id, lg.name)} style={{ ...smallBtn, color: 'var(--live)', borderColor: 'color-mix(in srgb, var(--live) 30%, var(--line))' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── RESET PICKS TAB ─────────────────────────────────────────── */
function ResetTab() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(apiPath('/api/admin/users'))
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setMsg('Network error loading users'); setLoading(false) })
  }, [])

  const filtered = users.filter(u =>
    search.length < 2 || u.username?.toLowerCase().includes(search.toLowerCase()) || u.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  async function reset(userId: string, name: string, type: 'bracket' | 'picks' | 'all') {
    const labels = { bracket: 'bracket', picks: 'match picks', all: 'ALL picks & bracket' }
    if (!confirm(`Reset ${labels[type]} for "${name}"?`)) return
    const res = await fetch(apiPath('/api/admin/reset-picks'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, type }),
    })
    const d = await res.json()
    setMsg(d.ok ? `Reset ${labels[type]} for ${name}.` : d.error ?? 'Error')
  }

  if (loading) return <div style={loadingStyle}>Loading users…</div>

  return (
    <div>
      {msg && <div style={msgStyle}>{msg}</div>}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by username…"
        className="input"
        style={{ marginBottom: 14 }}
      />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
        {filtered.slice(0, 50).map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? '1px solid var(--line)' : 'none', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{u.display_name ?? u.username}</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)' }}>@{u.username}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => reset(u.id, u.username, 'bracket')} style={smallBtn}>Reset bracket</button>
              <button onClick={() => reset(u.id, u.username, 'picks')} style={smallBtn}>Reset picks</button>
              <button onClick={() => reset(u.id, u.username, 'all')} style={{ ...smallBtn, color: 'var(--live)', borderColor: 'color-mix(in srgb, var(--live) 30%, var(--line))' }}>Reset all</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)' }}>No users found.</div>}
      </div>
    </div>
  )
}

/* ── SIMULATE TAB ────────────────────────────────────────────── */
function SimulateTab() {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: 'group' | 'bracket' | 'full' | 'reset') {
    const labels = {
      group:   'Simulating group stage…',
      bracket: 'Simulating bracket…',
      full:    'Simulating full tournament…',
      reset:   'Resetting…',
    }
    setBusy(true)
    setMsg(labels[action])
    try {
      const res = await fetch(apiPath('/api/admin/simulate'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      setMsg(d.message ?? d.error ?? 'Done')
    } catch {
      setMsg('Network error')
    }
    setBusy(false)
  }

  const steps = [
    {
      title: '1 · Group Stage',
      desc: 'Generates random scores for all 72 group matches, computes standings (pts / GD / GF), picks best 8 third-place teams, and writes results to tournament_results.',
      action: 'group' as const,
      label: 'Simulate Group Stage',
      color: 'var(--accent)',
    },
    {
      title: '2 · Bracket',
      desc: 'Uses the group results already in tournament_results to seed the R32, then randomly advances teams through R32 → R16 → QF → SF → Final.',
      action: 'bracket' as const,
      label: 'Simulate Bracket',
      color: 'var(--win)',
    },
    {
      title: 'Full Tournament',
      desc: 'Runs both steps above in a single call.',
      action: 'full' as const,
      label: 'Simulate Full Tournament',
      color: 'var(--gold)',
    },
    {
      title: '↩ Reset',
      desc: 'Resets all group matches to SCHEDULED, clears picks scoring, zeroes global_scores, and empties tournament_results. Start fresh.',
      action: 'reset' as const,
      label: 'Reset Everything',
      color: 'var(--live)',
    },
  ]

  return (
    <div>
      <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--gold) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--gold) 25%, var(--line))', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.8px', marginBottom: 4 }}>⚠ TEST MODE ONLY</div>
        <div style={{ fontFamily: 'var(--f-body)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          Simulation writes fake scores to the database. After running, use <strong>Score picks</strong> and <strong>Score brackets</strong> on the Matches tab to see full scoring. Reset when done testing.
        </div>
      </div>

      {msg && (
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--win)', background: 'color-mix(in srgb, var(--win) 8%, transparent)', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map(({ title, desc, action, label, color }) => (
          <div key={action} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>{title}</div>
            <div style={{ fontFamily: 'var(--f-body)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12 }}>{desc}</div>
            <button
              onClick={() => run(action)}
              disabled={busy}
              style={{
                ...actionBtn,
                color,
                borderColor: `color-mix(in srgb, ${color} 35%, var(--line))`,
                opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? '…' : label}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Shared styles ───────────────────────────────────────────── */
const actionBtn: React.CSSProperties = {
  padding: '7px 14px', border: '1px solid var(--line)', borderRadius: 9, cursor: 'pointer',
  background: 'var(--surface)', fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--ink-2)',
  transition: 'background .12s',
}
const smallBtn: React.CSSProperties = {
  padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 7, cursor: 'pointer',
  background: 'transparent', fontFamily: 'var(--f-mono)', fontWeight: 700, fontSize: 10.5, color: 'var(--ink-3)',
  whiteSpace: 'nowrap' as const,
}
const scoreInput: React.CSSProperties = {
  padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 18,
  textAlign: 'center' as const,
}
const loadingStyle: React.CSSProperties = {
  padding: '32px', textAlign: 'center' as const, fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--ink-3)',
}
const msgStyle: React.CSSProperties = {
  fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--win)',
  background: 'color-mix(in srgb, var(--win) 8%, transparent)',
  borderRadius: 8, padding: '8px 12px', marginBottom: 14,
}
