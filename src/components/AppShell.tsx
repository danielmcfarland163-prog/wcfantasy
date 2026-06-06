import BottomNav from './BottomNav'
import SideNav from './SideNav'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/admin'

interface AppShellProps {
  children: React.ReactNode
  dark?: boolean
  fullBleed?: boolean
}

export default async function AppShell({ children, dark, fullBleed }: AppShellProps) {
  let isAdmin = false
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) isAdmin = isAdminUser(user.id)
  } catch {}

  return (
    <div
      style={{
        height: '100svh',
        display: 'flex',
        overflow: 'hidden',
        background: dark ? 'var(--match-bg)' : 'var(--bg)',
      }}
    >
      {/* Desktop sidebar */}
      <div className="wc-sidebar">
        <SideNav isAdmin={isAdmin} />
      </div>

      {/* Main content column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Scrollable area — fills all space above the nav */}
        <div
          className="wc-noscroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="wc-page-inner">
            {children}
          </div>
        </div>

        {/* Mobile bottom nav — stays pinned at bottom, no fixed needed */}
        <div className="wc-mobile-nav" style={{ flexShrink: 0 }}>
          <BottomNav dark={dark} />
        </div>
      </div>
    </div>
  )
}
