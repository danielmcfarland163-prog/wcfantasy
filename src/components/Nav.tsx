'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/today',       label: 'Today' },
  { href: '/bracket',     label: 'Bracket' },
  { href: '/live',        label: 'Live' },
  { href: '/stats',       label: 'Stats' },
  { href: '/picks',       label: 'Picks' },
  { href: '/leagues',     label: 'Leagues' },
]

export default function Nav({ username }: { username: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <nav
      style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--surface)', borderBottom: '1px solid var(--line)',
        boxShadow: '0 1px 2px rgba(20,22,40,0.04)',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
        <Link href="/today" style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18, color: 'var(--accent)', textDecoration: 'none' }}>
          WC 2026
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', transition: 'background 0.15s',
                background: pathname.startsWith(href) ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                color: pathname.startsWith(href) ? 'var(--accent)' : 'var(--ink-2)',
              }}
            >
              {label}
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)' }}>@{username}</span>
          <button
            onClick={handleSignOut}
            style={{ fontSize: 13, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
