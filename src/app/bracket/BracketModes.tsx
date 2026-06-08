'use client'

import { useState } from 'react'
import BracketClient from './BracketClient'
import { BRACKET_MODES, type BracketMode, type BracketState } from '@/lib/bracket'

interface Props {
  userId: string
  pickemState: BracketState
  resetState: BracketState
  // tournament_results row (or null) — shape matches BracketClient's prop.
  tournamentResults?: any
}

export default function BracketModes({ userId, pickemState, resetState, tournamentResults }: Props) {
  const [mode, setMode] = useState<BracketMode>('pickem')
  const state = mode === 'pickem' ? pickemState : resetState

  return (
    <div>
      {/* Mode toggle — two independent bracket games */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }} className="wc-noscroll">
        {BRACKET_MODES.map(m => {
          const on = mode === m.key
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              aria-pressed={on}
              style={{
                flex: 1, textAlign: 'left', padding: '11px 14px', borderRadius: 14, cursor: 'pointer',
                border: on ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                background: on ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'var(--surface)',
                boxShadow: on ? '0 2px 10px -6px color-mix(in srgb, var(--accent) 60%, transparent)' : 'none',
                transition: 'all .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: on ? '5px solid var(--accent)' : '2px solid var(--line)',
                  background: 'var(--surface)', transition: 'all .15s',
                }} />
                <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 15, color: on ? 'var(--accent)' : 'var(--ink)' }}>
                  {m.label}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--f-body)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.3 }}>
                {m.blurb}
              </div>
            </button>
          )
        })}
      </div>

      {/* Remount on mode switch so each game keeps its own pick state */}
      <BracketClient
        key={mode}
        mode={mode}
        userId={userId}
        initialState={state}
        tournamentResults={tournamentResults}
      />
    </div>
  )
}
