'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

const TAUNT_MESSAGES = [
  '😂 Imagine picking that scoreline',
  '🤡 Bold prediction there chief',
  "📉 Your rank just dropped while I was typing",
  '⚽ Even the ref made better decisions than you',
  '🥲 Respectable attempt at football knowledge',
  "🧢 Don't quit your day job",
]

interface Props {
  leagueId: string
  userId: string
  username: string
}

export default function LeagueChat({ leagueId, userId, username }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load initial messages
  useEffect(() => {
    supabase
      .from('chat_messages')
      .select('*, profile:profiles(username, display_name)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[])
      })
  }, [leagueId])

  // Subscribe to realtime
  useEffect(() => {
    const channel = supabase
      .channel(`league-chat-${leagueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `league_id=eq.${leagueId}` },
        async (payload) => {
          // Fetch the full message with profile
          const { data } = await supabase
            .from('chat_messages')
            .select('*, profile:profiles(username, display_name)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages(prev => [...prev, data as ChatMessage])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [leagueId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content: string) {
    if (!content.trim() || sending) return
    setSending(true)
    setInput('')

    await supabase.from('chat_messages').insert({
      league_id: leagueId,
      user_id: userId,
      content: content.trim(),
    })

    setSending(false)
    inputRef.current?.focus()
  }

  async function sendTaunt() {
    const msg = TAUNT_MESSAGES[Math.floor(Math.random() * TAUNT_MESSAGES.length)]
    await sendMessage(msg)
  }

  return (
    <div className="card flex flex-col" style={{ height: '480px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <div className="text-2xl mb-1">💬</div>
            <p>No messages yet. Start the trash talk.</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.user_id === userId
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 uppercase shrink-0">
                {msg.profile?.username?.[0] ?? '?'}
              </div>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && (
                  <span className="text-xs text-gray-400 mb-0.5">{msg.profile?.display_name ?? msg.profile?.username}</span>
                )}
                <div className={`rounded-2xl px-3 py-1.5 text-sm ${
                  isMe
                    ? 'bg-green-600 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(msg.created_at)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        {/* Quick taunt button */}
        <button
          onClick={sendTaunt}
          className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
        >
          🎯 Random taunt
        </button>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Talk some trash…"
            maxLength={500}
            className="input flex-1 text-sm"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="btn-primary px-3"
          >
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
