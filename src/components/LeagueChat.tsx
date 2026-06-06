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

const AVATAR_COLORS = ['#2f6fe0','#1f9d5a','#e03c2c','#c98a1a','#7c3aed','#0891b2','#db2777','#059669']
function avatarColor(str: string) {
  let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

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
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: 480,
    }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}
        className="wc-noscroll">
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 40 }}>
            <div style={{ fontSize: 28 }}>💬</div>
            <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)' }}>No messages yet. Start the trash talk.</div>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.user_id === userId
          const displayName = msg.profile?.display_name ?? msg.profile?.username ?? 'Player'
          const initial = displayName[0]?.toUpperCase() ?? '?'
          const color = avatarColor(displayName)

          return (
            <div key={msg.id} style={{
              display: 'flex',
              flexDirection: isMe ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 12, color: '#fff', lineHeight: 1 }}>
                  {initial}
                </span>
              </div>

              {/* Bubble + meta */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                gap: 3, maxWidth: '72%',
              }}>
                {/* Username */}
                <span style={{
                  fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.4px', color: isMe ? 'var(--accent)' : 'var(--ink-3)',
                  textTransform: 'uppercase',
                }}>
                  {isMe ? 'You' : displayName}
                </span>

                {/* Bubble */}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isMe ? 'var(--accent)' : 'var(--surface-2)',
                  color: isMe ? '#fff' : 'var(--ink)',
                  fontFamily: 'var(--f-body)',
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                  border: isMe ? 'none' : '1px solid var(--line)',
                }}>
                  {msg.content}
                </div>

                {/* Timestamp */}
                <span style={{
                  fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--ink-3)',
                }}>
                  {formatRelativeTime(msg.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--line)',
        padding: '10px 12px 12px',
        background: 'var(--surface)',
      }}>
        {/* Taunt button */}
        <button
          onClick={sendTaunt}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.3px', color: 'var(--ink-3)',
            padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5,
            transition: 'color .12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
        >
          🎯 Random taunt
        </button>

        {/* Text input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Talk some trash…"
            maxLength={500}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              fontFamily: 'var(--f-body)',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color .15s, box-shadow .15s',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--line)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            style={{
              width: 38, height: 38, borderRadius: 12, border: 'none',
              background: input.trim() && !sending ? 'var(--accent)' : 'var(--surface-2)',
              color: input.trim() && !sending ? '#fff' : 'var(--ink-3)',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background .15s, color .15s',
            }}
          >
            {sending ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
