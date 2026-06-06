// Country flag image via flagcdn.com
// iso: 2-letter country code (e.g. 'us', 'mx', 'gb-eng')

interface FlagProps {
  iso?: string | null
  size?: number
  radius?: number
  ring?: boolean
  alt?: string
}

export default function Flag({ iso, size = 28, radius = 6, ring = true, alt = '' }: FlagProps) {
  if (!iso) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          flexShrink: 0,
          background: 'repeating-linear-gradient(45deg,#d8dadf,#d8dadf 4px,#e6e8ec 4px,#e6e8ec 8px)',
          boxShadow: ring ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none',
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: ring
          ? 'inset 0 0 0 1px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.1)'
          : 'none',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/h120/${iso.toLowerCase()}.png`}
        alt={alt}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        loading="lazy"
      />
    </div>
  )
}

// Team short-code → flagcdn ISO mapping
const FLAG_ISO: Record<string, string> = {
  MEX: 'mx', KOR: 'kr', RSA: 'za', CZE: 'cz',
  CAN: 'ca', SUI: 'ch', QAT: 'qa', BIH: 'ba',
  BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
  NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
  ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
}

export function isoForTeam(shortCode: string): string | null {
  return FLAG_ISO[shortCode?.toUpperCase()] ?? null
}
