import Flag, { isoForTeam } from '@/components/ui/Flag'
import LiveDot from '@/components/ui/LiveDot'
import type { MatchRowData } from './MatchRow'

interface Props {
  match: MatchRowData
  venue?: string
  onClick?: () => void
  stacked?: boolean // true = full-width stacked, false = carousel card
}

export default function LiveHero({ match, venue, onClick, stacked }: Props) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute, stage } = match

  return (
    <button
      onClick={onClick}
      style={{
        ...(stacked ? { width: '100%' } : { flex: '0 0 86%', scrollSnapAlign: 'center' }),
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        border: 'none',
        borderRadius: 22,
        padding: 0,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(150deg, var(--navy), color-mix(in srgb, var(--navy) 78%, #000))',
        boxShadow: '0 14px 30px -14px rgba(20,22,50,0.55)',
        display: 'block',
      }}
    >
      {/* glow */}
      <div
        className="wc-hero-glow"
        style={{
          position: 'absolute',
          top: -40,
          right: -30,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--live) 55%, transparent), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', padding: '14px 16px 16px', color: '#fff' }}>
        {/* top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="wc-live-badge">
            <LiveDot size={5} color="#fff" />
            LIVE {minute ?? ''}{'\''}
          </span>
          <span style={{
            fontFamily: 'var(--f-mono)', fontSize: 9.5, letterSpacing: 0.4, opacity: 0.7, textTransform: 'uppercase',
          }}>
            {stage}
          </span>
        </div>

        {/* scoreline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 84 }}>
            <Flag iso={isoForTeam(homeTeam.shortCode)} size={48} radius={10} alt={homeTeam.name} />
            <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>
              {homeTeam.shortCode}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 52, lineHeight: 1 }}>
              {homeScore ?? 0}
            </span>
            <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 400, fontSize: 24, opacity: 0.4 }}>:</span>
            <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 52, lineHeight: 1 }}>
              {awayScore ?? 0}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 84 }}>
            <Flag iso={isoForTeam(awayTeam.shortCode)} size={48} radius={10} alt={awayTeam.name} />
            <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>
              {awayTeam.shortCode}
            </span>
          </div>
        </div>

        {/* footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.12)', opacity: 0.8,
        }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" />
          </svg>
          <span style={{ fontFamily: 'var(--f-body)', fontSize: 11.5 }}>{venue ?? 'Stadium'}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'color-mix(in srgb, var(--live) 80%, white)' }}>
            Watch live ›
          </span>
        </div>
      </div>
    </button>
  )
}
