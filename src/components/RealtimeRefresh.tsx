'use client'

// Drop-in realtime refresher. Subscribes to Supabase postgres_changes for the
// given table(s) and calls router.refresh() (debounced) when rows change, so a
// server-rendered page re-fetches fresh data without a manual reload.
// The relevant tables are already on the `supabase_realtime` publication
// (matches, league_scores, global_scores, chat_messages).

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Props {
  tables: string[]
  /** Optional row filter applied to every table, e.g. `league_id=eq.<uuid>`. */
  filter?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  /** Override the channel name if multiple instances could collide. */
  channelId?: string
}

export default function RealtimeRefresh({ tables, filter, event = '*', channelId }: Props) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const key = tables.join(',')

  useEffect(() => {
    const supabase = createClient()
    const name = channelId ?? `rt-${key}-${filter ?? 'all'}`
    let channel = supabase.channel(name)

    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) } as any,
        () => {
          // A scoring run touches many rows; debounce the burst into one refresh.
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => router.refresh(), 400)
        },
      )
    }

    channel.subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, filter, event, channelId])

  return null
}
