// The app shows every calendar date as dd/mm/yyyy (en-GB), never in the browser's own locale order.
const DATE_OPTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }

export function formatDate(input: string | Date | null | undefined, timeZone?: string): string {
  if (!input) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return typeof input === 'string' ? input : ''
  return d.toLocaleDateString('en-GB', timeZone ? { ...DATE_OPTS, timeZone } : DATE_OPTS)
}

/** dd/mm/yyyy, hh:mm am/pm */
export function formatDateTime(input: string | Date | null | undefined, timeZone?: string): string {
  if (!input) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return typeof input === 'string' ? input : ''
  return d.toLocaleString('en-GB', { ...DATE_OPTS, hour: '2-digit', minute: '2-digit', hour12: true, ...(timeZone ? { timeZone } : {}) })
}
