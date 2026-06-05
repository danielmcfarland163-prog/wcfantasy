'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateLeaguePage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: league, error: createErr } = await supabase
      .from('leagues')
      .insert({ name, description, commissioner_id: user.id })
      .select()
      .single()

    if (createErr || !league) {
      setError('Could not create league. Try again.')
      setLoading(false)
      return
    }

    // Auto-join as commissioner
    await Promise.all([
      supabase.from('league_members').insert({ league_id: league.id, user_id: user.id }),
      supabase.from('league_scores').insert({ league_id: league.id, user_id: user.id, total_points: 0 }),
    ])

    router.push(`/leagues/${league.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/leagues" className="text-sm text-gray-500 hover:text-gray-700">← Back to leagues</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Create a league</h1>
          <p className="text-gray-500 text-sm mt-1">Invite friends with the code after creation.</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">League name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="The Boys League"
                required
                maxLength={50}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="May the best picker win"
                maxLength={100}
                className="input"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading || !name.trim()} className="btn-primary w-full">
              {loading ? 'Creating…' : 'Create league'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
