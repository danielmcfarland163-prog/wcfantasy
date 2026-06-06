'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import LiveDot from '@/components/ui/LiveDot'

const NAV = [
  {
    href: '/today',
    label: 'Today',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" />
      </svg>
    ),
  },
  {
    href: '/bracket',
    label: 'My Bracket',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h5v6h4M3 19h5v-6M21 12h-4m4-7h-5v6m5 8h-5v-6" />
      </svg>
    ),
  },
  {
    href: '/live',
    label: 'Live',
    live: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
        <path d="M6.5 6.5a8 8 0 0 0 0 11M17.5 6.5a8 8 0 0 1 0 11" />
      </svg>
    ),
  },
  {
    href: '/picks',
    label: 'My Picks',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: '/stats',
    label: 'Stats',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </svg>
    ),
  },
  {
    href: '/leagues',
    label: 'Leagues',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

export default function SideNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid var(--line)' }}>
        <div style={{
          fontFamily: 'var(--f-cond)',
          fontWeight: 800,
          fontSize: 22,
          color: 'var(--accent)',
          letterSpacing: '-0.3px',
          lineHeight: 1,
        }}>
          WC 2026
        </div>
        <div style={{
          fontFamily: 'var(--f-mono)',
          fontSize: 9,
          color: 'var(--ink-3)',
          letterSpacing: '1px',
          marginTop: 4,
          textTransform: 'uppercase',
        }}>
          USA · Canada · Mexico
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV.map(({ href, label, icon, live }) => {
          const active = pathname === href || (href !== '/today' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                marginBottom: 2,
                background: active
                  ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                  : 'transparent',
                color: active ? 'var(--accent)' : 'var(--ink-2)',
                fontFamily: 'var(--f-body)',
                fontWeight: active ? 700 : 500,
                fontSize: 14,
                transition: 'background .12s, color .12s',
                position: 'relative',
              }}
            >
              <span style={{
                opacity: active ? 1 : 0.7,
                display: 'flex',
                alignItems: 'center',
                color: active ? 'var(--accent)' : live ? 'var(--live)' : 'inherit',
              }}>
                {icon}
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              {live && (
                <span style={{ flexShrink: 0 }}>
                  <LiveDot size={5} color={active ? 'var(--accent)' : 'var(--live)'} />
                </span>
              )}
              {active && (
                <span style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: 3,
                  borderRadius: 4,
                  background: 'var(--accent)',
                }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px 20px', borderTop: '1px solid var(--line)' }}>
        {isAdmin && (
          <Link
            href="/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              textDecoration: 'none',
              marginBottom: 4,
              background: pathname.startsWith('/admin')
                ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                : 'transparent',
              color: pathname.startsWith('/admin') ? 'var(--accent)' : 'var(--ink-3)',
              fontFamily: 'var(--f-body)',
              fontSize: 13,
              fontWeight: pathname.startsWith('/admin') ? 700 : 500,
              transition: 'background .12s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4Z" />
              <circle cx="19" cy="8" r="3" fill="currentColor" stroke="none" opacity="0.7" />
              <path d="M17.5 6.5 19 8l2-2" strokeWidth="1.5" />
            </svg>
            Admin
          </Link>
        )}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--f-body)',
            fontSize: 13,
            color: 'var(--ink-3)',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background .12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  )
}
