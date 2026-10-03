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
  return sameDay ? formatClock(iso) : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
