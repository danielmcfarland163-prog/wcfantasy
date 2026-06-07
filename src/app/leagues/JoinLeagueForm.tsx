'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinLeagueForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const base = process.env.NEXT_PUBLIC_APP_URL ?? '/soccer-fantasy'
    const res = await fetch(`${base}/api/join-league`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Could not join league. Try again.')
      setLoading(false)
      return
    }

    router.push(`/leagues/${data.leagueId}`)
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Enter invite code"
          maxLength={8}
          className="input flex-1"
          style={{ fontFamily: 'var(--f-mono)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
        />
        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="btn-primary"
          style={{ whiteSpace: 'nowrap' }}
        >
          {loading ? 'Joining…' : 'Join'}
        </button>
      </form>
      {error && (
        <p style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--live)', marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  )
}
