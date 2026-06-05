'use client'

export default function CopyInviteButton({ inviteUrl }: { inviteUrl: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(inviteUrl)}
      className="text-xs text-gray-400 hover:text-gray-600 mt-1"
    >
      Copy link
    </button>
  )
}
