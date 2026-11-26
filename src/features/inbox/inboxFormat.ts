import { formatDate } from '@/lib/dateFormat'
export function isSessionOpen(sessionExpiresAt: string | null): boolean {
  return sessionExpiresAt ? new Date(sessionExpiresAt).getTime() > Date.now() : false
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// Today shows the time; any other day shows the date.
export function formatListTime(iso: string): string {
  const date = new Date(iso)
  const sameDay = date.toDateString() === new Date().toDateString()
  return sameDay ? formatClock(iso) : formatDate(date)
}

/** Label for the day divider in a chat: "Today", "Yesterday", else e.g. "Mon, 24 Nov 2026". */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
