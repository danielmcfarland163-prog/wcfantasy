'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import MatchCard from '@/components/MatchCard'
import { groupMatchesByDate, isMatchLocked } from '@/lib/utils'
import { format } from 'date-fns'
import type { MatchWithPick } from '@/lib/types'

type FilterMode = 'upcoming' | 'live' | 'all'

interface Props {
  userId: string
  initialMatches: MatchWithPick[]
}

export default function PicksClient({ userId, initialMatches }: Props) {
  const supabase = createClient()
  const [matches, setMatches] = useState(initialMatches)
  const [filter, setFilter] = useState<FilterMode>('upcoming')

  async function handlePickSaved(matchId: string, home: number, away: number, multiplier: number) {
    const { error } = await supabase.from('picks').upsert(
      {
        user_id: userId,
        match_id: matchId,
        home_score_pick: home,
        away_score_pick: away,
        confidence_multiplier: multiplier,
      },
      { onConflict: 'user_id,match_id' }
    )

    if (!error) {
      setMatches(prev =>
        prev.map(m =>
          m.id === matchId
            ? {
                ...m,
                userPick: {
                  ...m.userPick,
                  user_id: userId,
                  match_id: matchId,
                  home_score_pick: home,
                  away_score_pick: away,
                  confidence_multiplier: multiplier as 1 | 2 | 3,
                } as any,
              }
            : m
        )
      )
    }
  }

  const filtered = matches.filter(m => {
    if (filter === 'upcoming') return !isMatchLocked(m.kickoff_time)
    if (filter === 'live') return m.status === 'LIVE'
    return true
  })

  const grouped = groupMatchesByDate(filtered)
  const sortedDates = Object.keys(grouped).sort()

  const upcomingCount = matches.filter(m => !isMatchLocked(m.kickoff_time)).length
  const liveCount = matches.filter(m => m.status === 'LIVE').length

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {([
          { key: 'upcoming', label: `Upcoming (${upcomingCount})` },
          { key: 'live', label: liveCount > 0 ? `🔴 Live (${liveCount})` : 'Live' },
          { key: 'all', label: 'All matches' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sortedDates.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">⚽</div>
          <p>No matches here. Check another filter.</p>
        </div>
      )}

      {sortedDates.map(date => (
        <div key={date} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d')}
          </h2>
          <div className="space-y-3">
            {grouped[date].map(match => (
              <MatchCard
                key={match.id}
                match={match}
                onPickSaved={handlePickSaved}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
