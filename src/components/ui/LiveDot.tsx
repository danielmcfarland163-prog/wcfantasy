interface LiveDotProps {
  size?: number
  color?: string
}

export default function LiveDot({ size = 7, color = 'var(--live)' }: LiveDotProps) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <span
        className="wc-ping"
        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
      />
      <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: color }} />
    </span>
  )
}
