'use client'
import { useState, useTransition } from 'react'
import { cn, formatKickoff, isMatchLocked, getPickResultColor, getPickResultLabel, previewPickPoints } from '@/lib/utils'
import type { MatchWithPick } from '@/lib/types'

interface Props {
  match: MatchWithPick
  onPickSaved?: (matchId: string, home: number, away: number, multiplier: number) => void
}

export default function MatchCard({ match, onPickSaved }: Props) {
  const [home, setHome] = useState(match.userPick?.home_score_pick ?? 0)
  const [away, setAway] = useState(match.userPick?.away_score_pick ?? 0)
  const [multiplier, setMultiplier] = useState<1|2|3>(match.userPick?.confidence_multiplier as 1|2|3 ?? 1)
  const [saving, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const locked = match.isLocked

  const { correctPts, exactPts } = previewPickPoints(home, away, multiplier)
  const hasPick = match.userPick != null
  const result = match.userPick?.pick_result ?? null
  const pointsEarned = match.userPick?.points_earned ?? null

  function handleSave() {
    if (locked || !onPickSaved) return
    startTransition(async () => {
      await onPickSaved(match.id, home, away, multiplier)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const ScoreDisplay = ({ score, onChange, disabled }: {
    score: number; onChange: (v: number) => void; disabled: boolean
  }) => (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => !disabled && onChange(Math.max(0, score - 1))}
        disabled={disabled}
        className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors font-bold"
      >−</button>
      <span className="w-8 text-center text-2xl font-bold tabular-nums">{score}</span>
      <button
        onClick={() => !disabled && onChange(Math.min(20, score + 1))}
        disabled={disabled}
        className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors font-bold"
      >+</button>
    </div>
  )

  return (
    <div className={cn(
      'card p-4 transition-all',
      locked && 'bg-gray-50',
      result === 'EXACT' && 'ring-2 ring-emerald-400',
      result === 'CORRECT' && 'ring-2 ring-blue-300',
      result === 'WRONG' && 'ring-1 ring-red-200',
    )}>
      {/* Stage / group */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {match.stage === 'GROUP' ? `Group ${match.group_letter}` : match.stage}
        </span>
        <span className="text-xs text-gray-400">{formatKickoff(match.kickoff_time)}</span>
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <div className="flex-1 text-right">
          <div className="font-semibold text-gray-900 text-sm">{match.home_team?.name ?? '?'}</div>
          <div className="text-lg">{match.home_team?.flag_emoji ?? '🏳'}</div>
        </div>

        {/* Score input / result */}
        <div className="flex flex-col items-center gap-1 px-2">
          {locked && match.home_score !== null ? (
            // Actual result
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-800">{match.home_score}</span>
              <span className="text-gray-400 text-sm">–</span>
              <span className="text-2xl font-bold text-gray-800">{match.away_score}</span>
            </div>
          ) : (
            // Pick input
            <div className="flex items-center gap-2">
              <ScoreDisplay score={home} onChange={setHome} disabled={locked} />
              <span className="text-gray-400 font-medium">–</span>
              <ScoreDisplay score={away} onChange={setAway} disabled={locked} />
            </div>
          )}

          {/* Status label */}
          {match.status === 'LIVE' && (
            <span className="badge bg-red-100 text-red-700 animate-pulse">● LIVE</span>
          )}
          {locked && match.status !== 'LIVE' && match.status !== 'FINISHED' && (
            <span className="badge bg-gray-100 text-gray-500">Locked</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <div className="font-semibold text-gray-900 text-sm">{match.away_team?.name ?? '?'}</div>
          <div className="text-lg">{match.away_team?.flag_emoji ?? '🏳'}</div>
        </div>
      </div>

      {/* User's pick + result */}
      {locked && hasPick && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Your pick: <span className="font-semibold">{match.userPick!.home_score_pick}–{match.userPick!.away_score_pick}</span>
            {' '}×{match.userPick!.confidence_multiplier}
          </span>
          <div className="flex items-center gap-2">
            {result && (
              <span className={cn('badge text-xs', getPickResultColor(result))}>
                {getPickResultLabel(result)}
              </span>
            )}
            {pointsEarned !== null && (
              <span className="text-sm font-bold text-green-700">+{pointsEarned} pts</span>
            )}
          </div>
        </div>
      )}

      {/* Pick controls (not locked) */}
      {!locked && (
        <div className="mt-4 border-t border-gray-100 pt-3 flex items-center justify-between gap-3">
          {/* Multiplier */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">Confidence:</span>
            {([1, 2, 3] as const).map(m => (
              <button
                key={m}
                onClick={() => setMultiplier(m)}
                className={cn(
                  'w-7 h-7 rounded-full text-xs font-bold transition-colors',
                  multiplier === m
                    ? 'bg-green-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                )}
              >
                {m}×
              </button>
            ))}
          </div>

          {/* Potential pts + save */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {correctPts}–{exactPts} pts
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'btn-primary py-1.5 px-3 text-xs',
                saved && 'bg-emerald-600'
              )}
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : hasPick ? 'Update' : 'Save pick'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
