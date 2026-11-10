/** A local calendar day as YYYY-MM-DD (what the activity endpoint takes). */
export const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export type Preset = 'today' | 'yesterday' | '7d' | '30d'

export const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

/** The inclusive day range a preset stands for ("7 days" = today and the six days before it). */
export function rangeForPreset(preset: Preset, now = new Date()): { from: string; to: string } {
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  switch (preset) {
    case 'today':
      return { from: toDay(day(0)), to: toDay(day(0)) }
    case 'yesterday':
      return { from: toDay(day(-1)), to: toDay(day(-1)) }
    case '7d':
      return { from: toDay(day(-6)), to: toDay(day(0)) }
    case '30d':
      return { from: toDay(day(-29)), to: toDay(day(0)) }
  }
}

// The backend takes ranges of up to 366 days, so the month list and "All months" cover the last 12 months.
const MONTHS_BACK = 12

export interface MonthOption {
  /** YYYY-MM */
  value: string
  label: string
}

/** This month first, then the 11 before it. */
export function monthOptions(now = new Date()): MonthOption[] {
  return Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    }
  })
}

/** The whole month, or up to today for the current one. */
export function rangeForMonth(value: string, now = new Date()): { from: string; to: string } {
  const [y, m] = value.split('-').map(Number)
  const end = new Date(y, m, 0)
  return { from: toDay(new Date(y, m - 1, 1)), to: toDay(end > now ? now : end) }
}

/** The first day of the oldest listed month up to today. */
export function rangeForAllMonths(now = new Date()): { from: string; to: string } {
  return { from: toDay(new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1)), to: toDay(now) }
}

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/** 5400 -> "1h 30m". */
export function talkTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
