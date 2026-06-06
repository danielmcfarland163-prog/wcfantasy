'use client'
import { useState, type CSSProperties } from 'react'
import { formatKickoff, isMatchLocked } from '@/lib/utils'
import { previewPickPoints, getMatchResult } from '@/lib/scoring'
import type { MatchWithPick, ConfidenceMultiplier, WinnerPick } from '@/lib/types'
import Flag, { isoForTeam } from '@/components/ui/Flag'
import LiveDot from '@/components/ui/LiveDot'

export interface PickPayload {
  home: number
  away: number
  confidence: ConfidenceMultiplier
}

interface Props {
  match: MatchWithPick
  onPickSaved?: (matchId: string, payload: PickPayload) => Promise<void> | void
}

const MAX_GOALS = 20
const CONFIDENCE_OPTS: ConfidenceMultiplier[] = [1, 2, 3]

function clampGoals(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(MAX_GOALS, Math.trunc(n)))
}

export default function MatchCard({ match, onPickSaved }: Props) {
  const pick = match.userPick

  const savedHome = pick?.home_score_pick ?? null
  const savedAway = pick?.away_score_pick ?? null
  const savedConf = (pick?.confidence_multiplier ?? 1) as ConfidenceMultiplier

  const [home, setHome] = useState<number | null>(savedHome)
  const [away, setAway] = useState<number | null>(savedAway)
  const [confidence, setConfidence] = useState<ConfidenceMultiplier>(savedConf)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState(false)

  const locked = isMatchLocked(match.kickoff_time) || match.status === 'LIVE' || match.status === 'FINISHED'
  const live = match.status === 'LIVE'
  const finished = match.status === 'FINISHED'
  const showActual = (live || finished) && match.home_score !== null && match.away_score !== null
  const result = pick?.pick_result ?? null
  const hasPick = !!pick

  const homeISO = isoForTeam(match.home_team?.short_code ?? '')
  const awayISO = isoForTeam(match.away_team?.short_code ?? '')

  const actualResult: WinnerPick | null =
    match.home_score !== null && match.away_score !== null
      ? getMatchResult(match.home_score, match.away_score)
      : null

  const bothSet = home !== null && away !== null
  const dirty = home !== savedHome || away !== savedAway || confidence !== savedConf
  const canSave = !locked && bothSet && dirty && !saving
  const preview = bothSet ? previewPickPoints(home!, away!, confidence) : null

  async function handleSave() {
    if (!canSave || !onPickSaved) return
    setSaving(true)
    setError(false)
    try {
      await onPickSaved(match.id, { home: home!, away: away!, confidence })
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const stageLabel = match.stage === 'GROUP' ? `Group ${match.group_letter}` : match.stage

  const accentBorder = live
    ? '1.5px solid var(--live)'
    : result === 'EXACT' || result === 'CORRECT' ? '1.5px solid var(--win)'
    : result === 'WRONG' ? '1px solid color-mix(in srgb, var(--live) 30%, var(--line))'
    : '1px solid var(--line)'

  return (
    <div style={{
      background: 'var(--surface)',
      border: accentBorder,
      borderRadius: 16,
      padding: '13px 14px',
      boxShadow: live ? '0 6px 18px -8px rgba(224,60,44,0.35)' : '0 1px 2px rgba(20,22,40,0.04)',
    }}>
      {/* Header: stage + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          {stageLabel}
        </span>
        {live ? (
          <span className="wc-live-badge"><LiveDot size={5} color="#fff" /> LIVE</span>
        ) : finished ? (
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 6, padding: '2px 7px' }}>FT</span>
        ) : locked ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 6, padding: '2px 7px' }}>
            <LockIcon size={9} /> LOCKED
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderRadius: 6, padding: '2px 7px' }}>
            {formatKickoff(match.kickoff_time)}
          </span>
        )}
      </div>

      {/* Teams + center (actual score OR steppers) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: locked ? 4 : 10 }}>
        {/* Home team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <Flag iso={homeISO} size={34} radius={8} alt={match.home_team?.name ?? ''} />
          <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, fontSize: 11, color: 'var(--ink)', letterSpacing: 0.5 }}>
            {match.home_team?.short_code ?? '?'}
          </span>
        </div>

        {/* Center */}
        <div style={{ textAlign: 'center', minWidth: showActual || !locked ? 96 : 40 }}>
          {showActual ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ScoreNum n={match.home_score!} />
              <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 300, fontSize: 18, color: 'var(--ink-3)' }}>:</span>
              <ScoreNum n={match.away_score!} />
            </div>
          ) : locked ? (
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-3)' }}>vs</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Stepper value={home} onChange={setHome} label={`${match.home_team?.short_code ?? 'home'} score`} />
              <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 300, fontSize: 18, color: 'var(--ink-3)', paddingTop: 2 }}>:</span>
              <Stepper value={away} onChange={setAway} label={`${match.away_team?.short_code ?? 'away'} score`} />
            </div>
          )}
        </div>

        {/* Away team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <Flag iso={awayISO} size={34} radius={8} alt={match.away_team?.name ?? ''} />
          <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, fontSize: 11, color: 'var(--ink)', letterSpacing: 0.5 }}>
            {match.away_team?.short_code ?? '?'}
          </span>
        </div>
      </div>

      {/* OPEN: confidence selector + save */}
      {!locked && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 10px' }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, letterSpacing: 0.5, color: 'var(--ink-3)', textTransform: 'uppercase', flexShrink: 0 }}>
              Confidence
            </span>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {CONFIDENCE_OPTS.map(c => {
                const on = confidence === c
                return (
                  <button
                    key={c}
                    onClick={() => setConfidence(c)}
                    aria-pressed={on}
                    style={{
                      flex: 1, cursor: 'pointer', padding: '6px 4px', borderRadius: 9,
                      border: on ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                      background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)',
                      color: on ? 'var(--accent)' : 'var(--ink-3)',
                      fontFamily: 'var(--f-body)', fontWeight: on ? 800 : 600, fontSize: 13,
                      transition: 'all .12s',
                    }}
                  >
                    {c}×
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              width: '100%', padding: '10px 4px', borderRadius: 11, border: 'none',
              cursor: canSave ? 'pointer' : 'default',
              background: justSaved ? 'color-mix(in srgb, var(--win) 14%, var(--surface))'
                : canSave ? 'var(--accent)' : 'var(--surface-2)',
              color: justSaved ? 'var(--win)' : canSave ? '#fff' : 'var(--ink-3)',
              fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 13.5,
              transition: 'all .15s',
            }}
          >
            {saving ? 'Saving…' : justSaved ? '✓ Saved' : hasPick ? (dirty ? 'Update pick' : 'Saved · tap to edit') : 'Save pick'}
          </button>

          {preview && (
            <div style={{ marginTop: 7, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.2 }}>
              +{preview.correctPts} correct&nbsp;·&nbsp;+{preview.exactPts} exact
              {confidence > 1 && <span style={{ color: 'var(--accent)' }}>&nbsp;({confidence}× applied)</span>}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 7, textAlign: 'center', fontFamily: 'var(--f-body)', fontSize: 11.5, color: 'var(--live)' }}>
              Couldn’t save — check your connection and try again.
            </div>
          )}
        </>
      )}

      {/* LOCKED: your prediction + result */}
      {locked && (
        <div style={{ marginTop: 8 }}>
          {hasPick ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.3 }}>
                YOUR PICK
              </span>
              <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>
                {savedHome}–{savedAway}
              </span>
              {savedConf > 1 && (
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderRadius: 5, padding: '1px 5px' }}>
                  {savedConf}×
                </span>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontFamily: 'var(--f-body)', fontSize: 12, color: 'var(--ink-3)' }}>
              No pick made
            </div>
          )}

          {/* Result badge */}
          {result && (
            <div style={{
              marginTop: 9, padding: '9px 12px', borderRadius: 11,
              background: result === 'WRONG'
                ? 'color-mix(in srgb, var(--live) 10%, transparent)'
                : 'color-mix(in srgb, var(--win) 14%, transparent)',
              border: `1.5px solid ${result === 'WRONG'
                ? 'color-mix(in srgb, var(--live) 28%, var(--line))'
                : 'color-mix(in srgb, var(--win) 32%, var(--line))'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {result === 'WRONG' ? (
                <>
                  <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, fontSize: 15, color: 'var(--live)', lineHeight: 1 }}>✗</span>
                  <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 15, color: 'var(--live)', letterSpacing: 0.5 }}>WRONG</span>
                  {actualResult && (
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                      ·&nbsp;{actualResult === 'HOME' ? match.home_team?.short_code : actualResult === 'AWAY' ? match.away_team?.short_code : 'Draw'} won
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, fontSize: 15, color: 'var(--win)', lineHeight: 1 }}>
                    {result === 'EXACT' ? '⊛' : '✓'}
                  </span>
                  <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 15, color: 'var(--win)', letterSpacing: 0.5 }}>
                    {result === 'EXACT' ? 'EXACT SCORE' : 'CORRECT'}
                  </span>
                  <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 800, color: 'var(--win)' }}>
                    +{pick?.points_earned ?? 0} pts
                  </span>
                </>
              )}
            </div>
          )}

          {/* Live, not yet scored */}
          {live && !result && (
            <div style={{ marginTop: 9, textAlign: 'center', fontFamily: 'var(--f-body)', fontSize: 11.5, color: 'var(--live)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <LiveDot size={5} color="var(--live)" /> In play — result pending
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ScoreNum({ n }: { n: number }) {
  return (
    <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 28, lineHeight: 1, color: 'var(--ink)' }}>{n}</span>
  )
}

function Stepper({ value, onChange, label }: { value: number | null; onChange: (n: number) => void; label: string }) {
  const v = value ?? 0
  const btn: CSSProperties = {
    width: 30, height: 22, border: '1px solid var(--line)', background: 'var(--surface)',
    color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 13, lineHeight: 1, padding: 0,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <button
        type="button" aria-label={`Increase ${label}`}
        onClick={() => onChange(clampGoals(v + 1))}
        style={{ ...btn, borderRadius: '9px 9px 0 0', borderBottom: 'none' }}
      >▲</button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value === null ? '' : String(value)}
        onChange={e => {
          const raw = e.target.value.replace(/[^0-9]/g, '')
          if (raw === '') return onChange(0)
          onChange(clampGoals(parseInt(raw, 10)))
        }}
        style={{
          width: 44, height: 40, textAlign: 'center', border: '1.5px solid var(--line)',
          fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 26, color: 'var(--ink)',
          background: 'var(--surface)', outline: 'none', padding: 0, borderRadius: 0,
          MozAppearance: 'textfield',
        }}
      />
      <button
        type="button" aria-label={`Decrease ${label}`}
        onClick={() => onChange(clampGoals(v - 1))}
        style={{ ...btn, borderRadius: '0 0 9px 9px', borderTop: 'none' }}
      >▼</button>
    </div>
  )
}

function LockIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
