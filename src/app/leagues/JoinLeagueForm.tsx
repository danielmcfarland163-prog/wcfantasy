'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function JoinLeagueForm({ userId }: { userId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: league, error: leagueErr } = await supabase
      .from('leagues')
      .select('id, name, max_members')
      .eq('invite_code', code.trim().toUpperCase())
      .single()

    if (leagueErr || !league) {
      setError('League not found. Check the invite code.')
      setLoading(false)
      return
    }

    const { error: joinErr } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: userId })

    if (joinErr) {
      if (joinErr.code === '23505') {
        setError("You're already in this league!")
      } else {
        setError('Could not join league. Try again.')
      }
      setLoading(false)
      return
    }

    // Also upsert into league_scores
    await supabase.from('league_scores').upsert({
      league_id: league.id,
      user_id: userId,
      total_points: 0,
    }, { onConflict: 'league_id,user_id' })

    router.push(`/leagues/${league.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleJoin} className="flex gap-2">
      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="Enter invite code (e.g. AB12CD34)"
        maxLength={8}
        className="input flex-1 font-mono tracking-widest"
      />
      <button type="submit" disabled={loading || code.length < 6} className="btn-primary whitespace-nowrap">
        {loading ? 'Joining…' : 'Join'}
      </button>
    </form>
  )
  if (error) return <p className="text-sm text-red-600 mt-2">{error}</p>
}
