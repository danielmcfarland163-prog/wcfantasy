'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MATCH_PICKS_ENABLED } from '@/lib/features'

type GameMode = 'picks' | 'bracket' | 'both' | 'combined'

const MODES: { value: GameMode; icon: string; label: string; desc: string }[] = [
  { value: 'picks',    icon: '⚽', label: 'Match Picks',     desc: 'Predict scores for every match' },
  { value: 'bracket',  icon: '🗂',  label: 'Bracket',         desc: 'Fill out the full tournament bracket' },
  { value: 'both',     icon: '✦',  label: 'Both (separate)', desc: 'Separate leaderboard per mode' },
  { value: 'combined', icon: '⚡', label: 'Combined',        desc: 'One leaderboard — picks + bracket total' },
]

export default function CreateLeaguePage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  // Match Picks hidden for now — new leagues are Bracket-only.
  const [gameMode, setGameMode] = useState<GameMode>(MATCH_PICKS_ENABLED ? 'both' : 'bracket')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: league, error: createErr } = await supabase
      .from('leagues')
      .insert({ name, description, commissioner_id: user.id })
      .select()
      .single()

    if (createErr || !league) {
      setError('Could not create league. Try again.')
      setLoading(false)
      return
    }

    await Promise.all([
      supabase.from('league_members').insert({ league_id: league.id, user_id: user.id }),
      supabase.from('league_scores').insert({ league_id: league.id, user_id: user.id, total_points: 0 }),
      // game_mode requires the schema-dual-mode.sql migration — fails silently if not run yet
      supabase.from('leagues').update({ game_mode: gameMode }).eq('id', league.id),
    ])

    router.push(`/leagues/${league.id}`)
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/leagues" style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.5, color: 'var(--ink-3)', textDecoration: 'none' }}>
            ← Back to leagues
          </Link>
          <h1 className="wc-title" style={{ marginTop: 8 }}>Create a league</h1>
          <p style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            Invite friends with the code after creation.
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '24px' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <label style={{ display: 'block', fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.8, color: 'var(--ink-3)', marginBottom: 6 }}>
                LEAGUE NAME
              </label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="The Boys League" required maxLength={50} className="input" />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.8, color: 'var(--ink-3)', marginBottom: 6 }}>
                DESCRIPTION <span style={{ opacity: 0.6 }}>(optional)</span>
              </label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="May the best picker win" maxLength={100} className="input" />
            </div>

            {MATCH_PICKS_ENABLED && (
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.8, color: 'var(--ink-3)', marginBottom: 10 }}>
                GAME MODE
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MODES.map(m => {
                  const active = gameMode === m.value
                  return (
                    <button key={m.value} type="button" onClick={() => setGameMode(m.value)}
                      style={{ padding: '12px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', border: active ? '2px solid var(--accent)' : '1.5px solid var(--line)', background: active ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'var(--surface-2)', transition: 'all .15s' }}>
                      <div style={{ fontSize: 20, marginBottom: 5 }}>{m.icon}</div>
                      <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 13, color: active ? 'var(--accent)' : 'var(--ink)', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontFamily: 'var(--f-body)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.35 }}>{m.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>
            )}

            {error && (
              <p style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--live)', background: 'color-mix(in srgb, var(--live) 8%, transparent)', borderRadius: 10, padding: '10px 12px' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading || !name.trim()} className="btn-primary"
              style={{ width: '100%', marginTop: 4, padding: '14px', fontSize: 16 }}>
              {loading ? 'Creating…' : 'Create league →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
