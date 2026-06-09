'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  email: string
  initialUsername: string
  next?: string | null
}

export default function OnboardingForm({ userId, email, initialUsername, next }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [username, setUsername] = useState(initialUsername)
  const [wantsPassword, setWantsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const valid = /^[a-z0-9_]{3,20}$/.test(username)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!valid) {
      setError('Usernames are 3–20 characters: lowercase letters, numbers, and underscores.')
      return
    }
    if (wantsPassword) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirm) {
        setError('Passwords don’t match.')
        return
      }
    }

    setLoading(true)
    try {
      // 1. Claim the username + mark onboarding complete (RLS: update own row).
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ username, display_name: username, onboarded: true })
        .eq('id', userId)

      if (profileErr) {
        if (profileErr.code === '23505' || /duplicate|unique/i.test(profileErr.message)) {
          setError('That username is taken. Try another.')
        } else {
          setError(profileErr.message)
        }
        return
      }

      // 2. Optionally set a password (magic-link users start without one).
      if (wantsPassword) {
        const { error: pwErr } = await supabase.auth.updateUser({ password })
        if (pwErr) {
          setError(pwErr.message)
          return
        }
      }

      // 3. Mirror the flag into the JWT so middleware stops redirecting here.
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { onboarded: true, username },
      })
      if (metaErr) {
        setError(metaErr.message)
        return
      }

      router.push(next || '/today')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 46, marginBottom: 10 }}>🎉</div>
        <h1
          style={{
            fontFamily: 'var(--f-cond)',
            fontWeight: 800,
            fontSize: 32,
            color: '#fff',
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          You’re in!
        </h1>
        <p
          style={{
            fontFamily: 'var(--f-body)',
            fontSize: 14,
            color: 'rgba(255,255,255,0.6)',
            marginTop: 6,
          }}
        >
          Pick a username — it’s how you’ll show up on leaderboards.
        </p>
      </div>

      <div
        style={{
          width: '100%',
          background: 'var(--surface)',
          borderRadius: 22,
          padding: '24px 22px',
          boxShadow: '0 24px 48px -16px rgba(0,0,0,0.5)',
        }}
      >
        {email && (
          <p
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 11,
              color: 'var(--ink-3)',
              margin: '0 0 18px',
            }}
          >
            Signed in as {email}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              USERNAME
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  fontFamily: 'var(--f-mono)',
                  fontSize: 15,
                  color: 'var(--ink-3)',
                  pointerEvents: 'none',
                }}
              >
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={e =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                }
                placeholder="goatpicker99"
                required
                minLength={3}
                maxLength={20}
                autoFocus
                className="input"
                style={{ paddingLeft: 28 }}
              />
            </div>
            <p
              style={{
                fontFamily: 'var(--f-body)',
                fontSize: 11.5,
                color: 'var(--ink-3)',
                margin: '6px 0 0',
              }}
            >
              3–20 characters · lowercase letters, numbers, underscores.
            </p>
          </div>

          {!wantsPassword ? (
            <button
              type="button"
              onClick={() => setWantsPassword(true)}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--f-body)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--accent)',
                padding: 0,
              }}
            >
              + Set a password (optional)
            </button>
          ) : (
            <>
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
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  autoComplete="new-password"
                  className="input"
                />
              </div>
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
                  CONFIRM PASSWORD
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  autoComplete="new-password"
                  className="input"
                />
              </div>
              <p
                style={{
                  fontFamily: 'var(--f-body)',
                  fontSize: 11.5,
                  color: 'var(--ink-3)',
                  margin: '-4px 0 0',
                }}
              >
                Lets you sign in without a magic link next time.
              </p>
            </>
          )}

          {error && (
            <p
              style={{
                fontFamily: 'var(--f-body)',
                fontSize: 13,
                color: 'var(--live)',
                background: 'color-mix(in srgb, var(--live) 8%, transparent)',
                borderRadius: 10,
                padding: '10px 12px',
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !valid}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 16,
              marginTop: 2,
              opacity: loading || !valid ? 0.6 : 1,
            }}
          >
            {loading ? 'Setting up…' : 'Enter the tournament →'}
          </button>
        </form>
      </div>
    </div>
  )
}
