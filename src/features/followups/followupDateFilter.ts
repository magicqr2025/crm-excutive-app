// The Follow-ups page's due-date filter (same choices as orm-whatsapp's filter dialog).

export type FollowupDatePreset = 'today' | 'yesterday' | 'week' | 'custom'

export const FOLLOWUP_DATE_PRESETS: { value: FollowupDatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'custom', label: 'Custom' },
]

/** YYYY-MM-DD bounds; both empty = no filter. */
export interface FollowupDateRange {
  preset: FollowupDatePreset | ''
  from: string
  to: string
}

export const NO_DATE_RANGE: FollowupDateRange = { preset: '', from: '', to: '' }

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function dayOffset(offset: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d
}

/** The range a preset button stands for. "This week" is Monday to Sunday. Custom keeps what was typed. */
export function presetRange(preset: FollowupDatePreset, current: FollowupDateRange): FollowupDateRange {
  switch (preset) {
    case 'today':
      return { preset, from: ymd(dayOffset(0)), to: ymd(dayOffset(0)) }
    case 'yesterday':
      return { preset, from: ymd(dayOffset(-1)), to: ymd(dayOffset(-1)) }
    case 'week': {
      const monday = -((new Date().getDay() + 6) % 7)
      return { preset, from: ymd(dayOffset(monday)), to: ymd(dayOffset(monday + 6)) }
    }
    case 'custom':
      return { preset, from: current.from, to: current.to }
  }
}

function dmy(value: string): string {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

/** Chip text for an active range, e.g. "Due: This week" or "Due: 01/11/2026 – 15/11/2026". */
export function describeDateRange(range: FollowupDateRange): string {
  const label = FOLLOWUP_DATE_PRESETS.find((p) => p.value === range.preset)
  if (label && range.preset !== 'custom') return `Due: ${label.label}`
  if (range.from && range.to) return range.from === range.to ? `Due: ${dmy(range.from)}` : `Due: ${dmy(range.from)} – ${dmy(range.to)}`
  if (range.from) return `Due: from ${dmy(range.from)}`
  return `Due: up to ${dmy(range.to)}`
}
