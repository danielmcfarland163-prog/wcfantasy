import Flag, { isoForTeam } from '@/components/ui/Flag'
import StatusBadge from '@/components/ui/StatusBadge'

export interface MatchRowData {
  id: string
  homeTeam: { name: string; shortCode: string }
  awayTeam: { name: string; shortCode: string }
  homeScore?: number | null
  awayScore?: number | null
  status: string
  minute?: number | null
  stage?: string
  kickoffTime?: string
  displayTime?: string
}

interface Props {
  match: MatchRowData
  onClick?: () => void
}

export default function MatchRow({ match, onClick }: Props) {
  const { homeTeam, awayTeam, homeScore, awayScore, status, minute, stage, displayTime } = match
  const live = status === 'LIVE'
  const showScore = status === 'LIVE' || status === 'FT' || status === 'FINISHED'
  const hWin = showScore && (homeScore ?? 0) > (awayScore ?? 0)
  const aWin = showScore && (awayScore ?? 0) > (homeScore ?? 0)

  const teamLine = (
    name: string,
    shortCode: string,
    score: number | null | undefined,
    winner: boolean
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Flag iso={isoForTeam(shortCode)} size={24} radius={5} alt={name} ring={false} />
      <span style={{
        flex: 1,
        fontFamily: 'var(--f-body)',
        fontWeight: winner ? 700 : 600,
        fontSize: 15,
        color: !winner && showScore ? 'var(--ink-2)' : 'var(--ink)',
      }}>
        {name}
      </span>
      {showScore && (
        <span style={{
          fontFamily: 'var(--f-cond)',
          fontWeight: 800,
          fontSize: 22,
          lineHeight: 1,
          color: !winner ? 'var(--ink-3)' : 'var(--ink)',
        }}>
          {score ?? 0}
        </span>
      )}
    </div>
  )

  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        background: 'var(--surface)',
        border: live
          ? '1.5px solid var(--live)'
          : '1px solid var(--line)',
        borderRadius: 16,
        padding: '12px 14px',
        position: 'relative',
        boxShadow: live
          ? '0 0 0 0px transparent, 0 6px 18px -8px rgba(224,60,44,0.4)'
          : '0 1px 2px rgba(20,22,40,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontFamily: 'var(--f-mono)',
          fontSize: 9.5,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}>
          {stage}
        </span>
        <StatusBadge status={status} minute={minute} time={displayTime} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {teamLine(homeTeam.name, homeTeam.shortCode, homeScore, hWin)}
        {teamLine(awayTeam.name, awayTeam.shortCode, awayScore, aWin)}
      </div>
    </button>
  )
}
