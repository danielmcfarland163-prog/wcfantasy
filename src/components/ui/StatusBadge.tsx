import LiveDot from './LiveDot'

interface StatusBadgeProps {
  status: 'LIVE' | 'FT' | 'SCHEDULED' | 'UPCOMING' | 'POSTPONED' | string
  minute?: number | null
  time?: string | null
}

export default function StatusBadge({ status, minute, time }: StatusBadgeProps) {
  if (status === 'LIVE') {
    return (
      <span className="wc-live-badge">
        <LiveDot size={5} color="#fff" />
        {minute ? `${minute}'` : 'LIVE'}
      </span>
    )
  }
  if (status === 'FT' || status === 'FINISHED') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        background: 'var(--surface-2)', color: 'var(--ink-3)', borderRadius: 6,
        padding: '3px 8px', fontFamily: 'var(--f-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
      }}>
        FT
      </span>
    )
  }
  // upcoming / scheduled
  const label = time ?? status
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
      color: 'var(--accent)', borderRadius: 6,
      padding: '3px 8px', fontFamily: 'var(--f-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
    }}>
      {label}
    </span>
  )
}
