'use client'
import { useEffect, useState } from 'react'
import { TOURNAMENT_LOCK } from '@/lib/bracket'

// Live countdown to the bracket lock (June 11, 2026 15:00 UTC).
//  • > 24h out  → subtle informational chip with the lock date
//  • ≤ 24h out  → prominent amber warning with a ticking HH:MM:SS timer
//  • locked     → nothing (the parent renders the locked state)
//
// Rendering is gated on a mounted flag so the server and first client paint
// agree (no hydration mismatch from Date.now()).

const WARN_WINDOW_MS = 24 * 60 * 60 * 1000

function two(n: number) {
  return String(n).padStart(2, '0')
}

const LOCK_LABEL = TOURNAMENT_LOCK.toLocaleString('en-GB', {
  weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'UTC', hour12: false,
}) + ' UTC'

export default function LockCountdown({ lockTime = TOURNAMENT_LOCK }: { lockTime?: Date }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (now === null) return null // pre-mount: render nothing to keep hydration stable

  const diff = lockTime.getTime() - now
  if (diff <= 0) return null // locked — parent shows the locked banner

  const within24h = diff <= WARN_WINDOW_MS
  const totalSec = Math.floor(diff / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  if (!within24h) {
    // Informational chip — calm, professional
    return (
      <div style={{
        margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--line)',
      }}>
        <span style={{ fontSize: 13 }} aria-hidden>🔒</span>
        <span style={{ fontFamily: 'var(--f-body)', fontSize: 12.5, color: 'var(--ink-2)' }}>
          Bracket locks <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{LOCK_LABEL}</strong>
        </span>
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700,
          color: 'var(--ink-3)', letterSpacing: '0.5px',
        }}>
          {days}d {two(hours)}h left
        </span>
      </div>
    )
  }

  // Final 24h — prominent amber warning with a live timer
  return (
    <div
      role="status"
      style={{
        margin: '0 0 16px', padding: '12px 16px', borderRadius: 14,
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, var(--surface)), color-mix(in srgb, var(--gold) 6%, var(--surface)))',
        border: '1.5px solid color-mix(in srgb, var(--gold) 42%, var(--line))',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0,
          boxShadow: '0 0 0 0 color-mix(in srgb, var(--gold) 70%, transparent)',
          animation: 'lockPulse 1.6s ease-out infinite',
        }} aria-hidden />
        <div>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Bracket locks soon
          </div>
          <div style={{ fontFamily: 'var(--f-body)', fontSize: 12, color: 'var(--ink-2)', marginTop: 1 }}>
            Make your picks final — locks {LOCK_LABEL}
          </div>
        </div>
      </div>
      <div
        aria-label={`${hours} hours ${mins} minutes ${secs} seconds remaining`}
        style={{
          fontFamily: 'var(--f-mono)', fontWeight: 800, fontSize: 20, color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px', flexShrink: 0,
        }}
      >
        {two(hours)}<span style={{ color: 'var(--gold)' }}>:</span>{two(mins)}<span style={{ color: 'var(--gold)' }}>:</span>{two(secs)}
      </div>
      <style>{`@keyframes lockPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--gold) 70%,transparent)}70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>
    </div>
  )
}
