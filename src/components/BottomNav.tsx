'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LiveDot from '@/components/ui/LiveDot'
import { MATCH_PICKS_ENABLED } from '@/lib/features'

const NAV = [
  {
    href: '/today',
    label: 'Today',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" />
      </svg>
    ),
  },
  ...(MATCH_PICKS_ENABLED ? [{
    href: '/picks',
    label: 'Picks',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  }] : []),
  {
    href: '/live',
    label: 'Live',
    center: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
        <path d="M6.5 6.5a8 8 0 0 0 0 11M17.5 6.5a8 8 0 0 1 0 11M3.8 3.8a12 12 0 0 0 0 16.4M20.2 3.8a12 12 0 0 1 0 16.4" />
      </svg>
    ),
  },
  {
    href: '/leagues',
    label: 'Leagues',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/bracket',
    label: 'Bracket',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h5v6h4M3 19h5v-6M21 12h-4m4-7h-5v6m5 8h-5v-6" />
      </svg>
    ),
  },
]

interface BottomNavProps {
  dark?: boolean
}

export default function BottomNav({ dark }: BottomNavProps) {
  const pathname = usePathname()

  const inactive = dark ? 'rgba(255,255,255,0.5)' : 'var(--ink-3)'
  const accent = 'var(--accent)'

  return (
    <nav
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        padding: '8px 12px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        position: 'relative',
        background: dark
          ? 'color-mix(in srgb, var(--match-bg) 88%, transparent)'
          : 'color-mix(in srgb, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        borderTop: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--line)',
        zIndex: 50,
      }}
    >
      {NAV.map(item => {
        const isActive = pathname.startsWith(item.href)
        const color = isActive ? accent : inactive

        if (item.center) {
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                marginTop: -22,
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(140deg, var(--live), color-mix(in srgb, var(--live) 70%, var(--accent)))',
                  boxShadow: '0 8px 18px -6px var(--live), inset 0 1px 0 rgba(255,255,255,0.3)',
                  position: 'relative',
                  color: '#fff',
                }}
              >
                {item.icon}
                <span style={{ position: 'absolute', top: 8, right: 8 }}>
                  <LiveDot size={5} color="#fff" />
                </span>
              </div>
              <span style={{
                fontFamily: 'var(--f-body)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--live)',
              }}>
                {item.label}
              </span>
            </Link>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              width: 60,
              padding: '4px 0',
              textDecoration: 'none',
              color,
            }}
          >
            {item.icon}
            <span style={{
              fontFamily: 'var(--f-body)',
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              color,
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
