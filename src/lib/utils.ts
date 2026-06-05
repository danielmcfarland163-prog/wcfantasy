import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isPast } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKickoff(isoString: string): string {
  const d = new Date(isoString)
  return format(d, 'EEE d MMM, h:mm a')
}

export function formatRelativeTime(isoString: string): string {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true })
}

export function isMatchLocked(kickoffTime: string): boolean {
  return isPast(new Date(kickoffTime))
}

export function getPickResultColor(result: string | null): string {
  if (result === 'EXACT') return 'text-emerald-600 bg-emerald-50'
  if (result === 'CORRECT') return 'text-blue-600 bg-blue-50'
  if (result === 'WRONG') return 'text-red-600 bg-red-50'
  return 'text-gray-500 bg-gray-50'
}

export function getPickResultLabel(result: string | null): string {
  if (result === 'EXACT') return '⚽ Exact!'
  if (result === 'CORRECT') return '✓ Correct'
  if (result === 'WRONG') return '✗ Wrong'
  return '—'
}

export function generateInviteUrl(inviteCode: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/join/${inviteCode}`
}

// Group matches by date for display
export function groupMatchesByDate<T extends { kickoff_time: string }>(
  matches: T[]
): Record<string, T[]> {
  return matches.reduce((groups, match) => {
    const date = format(new Date(match.kickoff_time), 'yyyy-MM-dd')
    if (!groups[date]) groups[date] = []
    groups[date].push(match)
    return groups
  }, {} as Record<string, T[]>)
}
