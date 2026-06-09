'use client'

import { useState } from 'react'

// Copies the league invite link. The URL is normally rendered server-side from
// NEXT_PUBLIC_APP_URL; if that env var is missing/misconfigured (so the string is
// relative or literally "undefined/join/…"), we rebuild a correct absolute link
// from the browser's own origin + basePath so the copied link always works.
export default function CopyInviteButton({ inviteUrl, inviteCode }: { inviteUrl: string; inviteCode?: string }) {
  const [copied, setCopied] = useState(false)

  function resolvedUrl(): string {
    const looksAbsolute = /^https?:\/\//.test(inviteUrl) && !inviteUrl.startsWith('undefined')
    if (looksAbsolute || !inviteCode || typeof window === 'undefined') return inviteUrl
    // On /leagues/[id] the basePath is everything before "/leagues".
    const base = window.location.pathname.split('/leagues')[0]
    return `${window.location.origin}${base}/join/${inviteCode}`
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(resolvedUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button onClick={copy} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}
