'use client'

interface PillTabsProps {
  tabs: string[]
  active: string
  onChange: (tab: string) => void
  dark?: boolean
  className?: string
}

export default function PillTabs({ tabs, active, onChange, dark, className }: PillTabsProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 2,
        padding: 3,
        borderRadius: 11,
        margin: '0 20px',
        background: dark ? 'rgba(255,255,255,0.08)' : 'var(--surface-2)',
      }}
    >
      {tabs.map(tab => {
        const on = tab === active
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              flex: 1,
              border: 'none',
              cursor: 'pointer',
              padding: '8px 4px',
              borderRadius: 8,
              background: on ? (dark ? 'rgba(255,255,255,0.16)' : 'var(--surface)') : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
              fontFamily: 'var(--f-body)',
              fontWeight: on ? 700 : 600,
              fontSize: 13,
              color: on ? (dark ? '#fff' : 'var(--ink)') : (dark ? 'rgba(255,255,255,0.5)' : 'var(--ink-3)'),
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        )
      })}
    </div>
  )
}
