interface StatBarProps {
  label: string
  a: number
  b: number
  unit?: string
}

export default function StatBar({ label, a, b, unit = '' }: StatBarProps) {
  const total = a + b || 1
  const ap = Math.round((a / total) * 100)
  const aLead = a >= b
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 17, color: aLead ? 'var(--c-home, var(--accent))' : 'inherit' }}>
          {a}{unit}
        </span>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.6 }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 17, color: !aLead ? 'var(--c-away, var(--live))' : 'inherit' }}>
          {b}{unit}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 3, height: 5 }}>
        <div style={{ flex: ap, background: 'var(--c-home, var(--accent))', borderRadius: 3, opacity: aLead ? 1 : 0.45 }} />
        <div style={{ flex: 100 - ap, background: 'var(--c-away, var(--live))', borderRadius: 3, opacity: !aLead ? 1 : 0.45 }} />
      </div>
    </div>
  )
}
