'use client'

import { useState, type ReactNode } from 'react'
import { MATCH_PICKS_ENABLED } from '@/lib/features'

// Client tab switcher for the per-player summary. The Picks and Bracket panels
// are server-rendered and passed in as props (RSC children), so this only owns
// the active-tab state.
export default function SummaryTabs({ picks, bracket }: { picks: ReactNode; bracket: ReactNode }) {
  const [tab, setTab] = useState<'picks' | 'bracket'>('picks')

  // Match Picks hidden for now — show the bracket on its own, no tab switcher.
  if (!MATCH_PICKS_ENABLED) return <>{bracket}</>

  const tabs: { key: 'picks' | 'bracket'; label: string }[] = [
    { key: 'picks',   label: '⚽ Match Picks' },
    { key: 'bracket', label: '🗂 Bracket' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 11, background: 'var(--surface-2)', marginBottom: 18 }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, border: 'none', cursor: 'pointer', padding: '8px 6px', borderRadius: 8,
              background: tab === key ? 'var(--surface)' : 'transparent',
              boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              fontFamily: 'var(--f-body)', fontWeight: tab === key ? 700 : 500, fontSize: 13,
              color: tab === key ? 'var(--ink)' : 'var(--ink-3)', transition: 'all .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div>{tab === 'picks' ? picks : bracket}</div>
    </div>
  )
}
