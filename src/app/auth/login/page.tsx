'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Mode = 'magic' | 'login' | 'signup'

const CALLBACK = '/soccer-fantasy/auth/callback'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Surface errors handed back by the callback route (?error=link).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('error')
    if (p === 'link') setError('That link expired or was already used. Request a new one below.')
  }, [])

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
    setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      // Optional return path (e.g. an invite link sends ?next=/join/CODE). Kept
      // app-relative and same-origin to avoid open redirects; forwarded through
      // the email callback so magic-link / signup land back on it too.
      const next = safeNext()
      const callbackUrl = `${window.location.origin}${CALLBACK}${next ? `?next=${encodeURIComponent(next)}` : ''}`

      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callbackUrl },
        })
        if (error) throw error
        setMessage('Check your email for a one-tap login link. ✉️')
        return
      }

      if (mode === 'signup') {
        if (password !== confirm) throw new Error('Passwords don’t match.')
        if (password.length < 8) throw new Error('Password must be at least 8 characters.')
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl },
        })
        if (error) throw error
        setMessage('Account created! Check your email to confirm, then you’ll pick a username.')
        return
      }

      // Password sign-in
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(next ?? '/today')
      router.refresh()
    } catch (err: any) {
      setError(prettifyError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  const MODES: { key: Mode; label: string }[] = [
    { key: 'magic', label: '✨ Magic link' },
    { key: 'login', label: 'Sign in' },
    { key: 'signup', label: 'Sign up' },
  ]

  const cta =
    mode === 'magic' ? 'Send magic link →' : mode === 'signup' ? 'Create account →' : 'Sign in →'

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        background: 'linear-gradient(160deg, #0d1a2e 0%, #1a2f4e 50%, #0d2215 100%)',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <Link href="/" style={{ textDecoration: 'none', textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🌍⚽</div>
        <h1
          style={{
            fontFamily: 'var(--f-cond)',
            fontWeight: 800,
            fontSize: 36,
            color: '#fff',
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          Soccer Fantasy Game
        </h1>
        <p
          style={{
            fontFamily: 'var(--f-body)',
            fontSize: 14,
            color: 'rgba(255,255,255,0.6)',
            marginTop: 6,
          }}
        >
          Fill your bracket. Trash talk your friends.
        </p>
      </Link>

      {/* Card */}
      <div
        style={{
          width: '100%',
          background: 'var(--surface)',
          borderRadius: 22,
          padding: '24px 22px',
          boxShadow: '0 24px 48px -16px rgba(0,0,0,0.5)',
        }}
      >
        {/* Mode tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 3,
            borderRadius: 11,
            background: 'var(--surface-2)',
            marginBottom: 22,
          }}
        >
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              style={{
                flex: 1,
                border: 'none',
                cursor: 'pointer',
                padding: '8px 4px',
                borderRadius: 8,
                background: mode === key ? 'var(--surface)' : 'transparent',
                boxShadow: mode === key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                fontFamily: 'var(--f-body)',
                fontWeight: mode === key ? 700 : 600,
                fontSize: 12.5,
                color: mode === key ? 'var(--ink)' : 'var(--ink-3)',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="EMAIL">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="input"
            />
          </Field>

          {mode !== 'magic' && (
            <Field label="PASSWORD">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="input"
              />
            </Field>
          )}

          {mode === 'signup' && (
            <Field label="CONFIRM PASSWORD">
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
              />
            </Field>
          )}

          {mode === 'magic' && (
            <p
              style={{
                fontFamily: 'var(--f-body)',
                fontSize: 12,
                color: 'var(--ink-3)',
                margin: '-2px 0 0',
                lineHeight: 1.4,
              }}
            >
              No password needed — we’ll email you a secure link to sign in.
            </p>
          )}

          {error && <Banner kind="error">{error}</Banner>}
          {message && <Banner kind="success">{message}</Banner>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: 16, marginTop: 2, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Loading…' : cta}
          </button>
        </form>
      </div>

      <p
        style={{
          textAlign: 'center',
          color: 'rgba(255,255,255,0.3)',
          fontFamily: 'var(--f-mono)',
          fontSize: 10,
          marginTop: 20,
        }}
      >
        NOT AFFILIATED WITH FIFA · BUILT FOR FUN
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontFamily: 'var(--f-mono)',
          fontSize: 10,
          letterSpacing: 0.8,
          color: 'var(--ink-3)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function Banner({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  const color = kind === 'error' ? 'var(--live)' : 'var(--win)'
  return (
    <p
      style={{
        fontFamily: 'var(--f-body)',
        fontSize: 13,
        color,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        borderRadius: 10,
        padding: '10px 12px',
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

// Same-origin, app-relative return path from ?next (open-redirect-safe).
function safeNext(): string | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('next')
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null
}

function prettifyError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (m.includes('already registered')) return 'That email is already registered — try signing in.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.'
  if (m.includes('email') && m.includes('invalid')) return 'That email doesn’t look right.'
  return msg
}
