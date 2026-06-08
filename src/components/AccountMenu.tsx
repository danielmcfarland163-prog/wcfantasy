'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Mobile/header account control: shows the signed-in user and a sign-out action.
// (Desktop also has sign-out in the SideNav footer.)
export default function AccountMenu({ username }: { username?: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const initial = (username?.trim()?.[0] ?? '?').toUpperCase()

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 60%, var(--win)))',
          color: '#fff',
          fontFamily: 'var(--f-cond)',
          fontWeight: 800,
          fontSize: 16,
          boxShadow: '0 2px 8px -2px var(--accent)',
        }}
      >
        {initial}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              zIndex: 41,
              minWidth: 180,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              boxShadow: '0 16px 32px -12px rgba(20,22,40,0.28)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: 10,
                  letterSpacing: 0.6,
                  color: 'var(--ink-3)',
                }}
              >
                SIGNED IN AS
              </div>
              <div
                style={{
                  fontFamily: 'var(--f-body)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--ink)',
                  marginTop: 2,
                }}
              >
                @{username ?? 'player'}
              </div>
            </div>
            <Link
              href="/how-to-play"
              onClick={() => setOpen(false)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '12px 14px',
                borderBottom: '1px solid var(--line)',
                background: 'transparent',
                textDecoration: 'none',
                fontFamily: 'var(--f-body)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink-2)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3M12 17h.01" />
              </svg>
              How to Play
            </Link>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '12px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--f-body)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--live)',
                textAlign: 'left',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
