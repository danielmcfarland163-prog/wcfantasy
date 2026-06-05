'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatKickoff } from '@/lib/utils'
import type { Match } from '@/lib/types'

interface MatchWithTeams extends Match {
  home_team?: { name: string; flag_emoji: string | null }
  away_team?: { name: string; flag_emoji: string | null }
}

export default function AdminClient({ initialMatches }: { initialMatches: MatchWithTeams[] }) {
  const supabase = createClient()
  const [matches, setMatches] = useState(initialMatches)
  const [editing, setEditing] = useState<string | null>(null)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [saving, setSaving] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSaveScore(matchId: string) {
    setSaving(true)
    const { error } = await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status: 'FINISHED' })
      .eq('id', matchId)

    if (!error) {
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, home_score: homeScore, away_score: awayScore, status: 'FINISHED' } : m
      ))
      setEditing(null)
      setMessage(`✓ Score saved. Run /api/score-picks to trigger scoring.`)
    }
    setSaving(false)
  }

  async function handleBootstrap() {
    setBootstrapping(true)
    setMessage('')
    const res = await fetch('/api/bootstrap-matches', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
    })
    const data = await res.json()
    setMessage(data.message ?? JSON.stringify(data))
    setBootstrapping(false)
  }

  async function handleTriggerSync() {
    setMessage('Triggering score sync…')
    const res = await fetch('/api/sync-scores', {
      headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
    })
    const data = await res.json()
    setMessage(data.message ?? JSON.stringify(data))
  }

  async function handleTriggerScoring() {
    setMessage('Scoring picks…')
    const res = await fetch('/api/score-picks', {
      headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
    })
    const data = await res.json()
    setMessage(data.message ?? JSON.stringify(data))
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleBootstrap} disabled={bootstrapping} className="btn-secondary text-sm">
            {bootstrapping ? 'Importing…' : '🔄 Import matches from API'}
          </button>
          <button onClick={handleTriggerSync} className="btn-secondary text-sm">
            📡 Sync live scores
          </button>
          <button onClick={handleTriggerScoring} className="btn-secondary text-sm">
            ⚡ Score picks now
          </button>
        </div>
        {message && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mt-3">{message}</p>
        )}
      </div>

      {/* Match list with score override */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Match scores</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Match</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Kickoff</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Score</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {matches.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 text-xs">
                    {m.home_team?.flag_emoji} {m.home_team?.name} vs {m.away_team?.flag_emoji} {m.away_team?.name}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{formatKickoff(m.kickoff_time)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {editing === m.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input type="number" min="0" max="20" value={homeScore} onChange={e => setHomeScore(+e.target.value)} className="w-12 text-center border border-gray-300 rounded px-1 py-0.5 text-xs" />
                        <span>–</span>
                        <input type="number" min="0" max="20" value={awayScore} onChange={e => setAwayScore(+e.target.value)} className="w-12 text-center border border-gray-300 rounded px-1 py-0.5 text-xs" />
                      </div>
                    ) : (
                      <span className="font-mono text-xs">
                        {m.home_score ?? '—'} – {m.away_score ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge text-xs ${
                      m.status === 'LIVE' ? 'bg-red-100 text-red-700' :
                      m.status === 'FINISHED' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editing === m.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleSaveScore(m.id)} disabled={saving} className="btn-primary py-1 px-2 text-xs">
                          {saving ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(null)} className="btn-secondary py-1 px-2 text-xs">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditing(m.id); setHomeScore(m.home_score ?? 0); setAwayScore(m.away_score ?? 0) }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Override
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
