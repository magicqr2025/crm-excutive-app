// The date range at the top of the Meetings page (ported from orm-whatsapp). It bounds every number and row on the page.

/** Which date the range applies to: when the meeting happens, or when it was created / booked. */
export type RangeBasis = 'meeting' | 'created'

export type RangePreset = 'today' | 'tomorrow' | 'yesterday' | 'week' | 'next7' | 'past7' | 'last7' | 'last30' | 'all' | 'custom'

export interface MeetingRangeValue {
  preset: RangePreset
  /** YYYY-MM-DD; used only for 'custom'. */
  from: string
  to: string
  basis: RangeBasis
}

// Default: meetings happening today.
export const DEFAULT_MEETING_RANGE: MeetingRangeValue = { preset: 'today', from: '', to: '', basis: 'meeting' }

// The buttons for each basis. A meeting can happen in the future, but can only have been created in the past.
export const RANGE_PRESETS: Record<RangeBasis, { value: RangePreset; label: string }[]> = {
  meeting: [
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'week', label: 'This week' },
    { value: 'next7', label: 'Next 7 days' },
    { value: 'past7', label: 'Past 7 days' },
    { value: 'all', label: 'All' },
    { value: 'custom', label: 'Custom' },
  ],
  created: [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7', label: 'Last 7 days' },
    { value: 'last30', label: 'Last 30 days' },
    { value: 'all', label: 'All' },
    { value: 'custom', label: 'Custom' },
  ],
}

/** Switching basis keeps the button if the other list has it, else goes back to Today. */
export function withBasis(range: MeetingRangeValue, basis: RangeBasis): MeetingRangeValue {
  const keep = RANGE_PRESETS[basis].some((p) => p.value === range.preset)
  return { ...range, basis, preset: keep ? range.preset : 'today' }
}

// Start of a local day, `offset` days from today.
function dayStart(offset: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}

function dayEnd(offset: number): Date {
  const d = dayStart(offset)
  d.setHours(23, 59, 59, 999)
  return d
}

// Local-day offsets [first, last] for each fixed button. "This week" is Monday to Sunday.
function presetDays(preset: RangePreset): [number, number] | null {
  switch (preset) {
    case 'today':
      return [0, 0]
    case 'tomorrow':
      return [1, 1]
    case 'yesterday':
      return [-1, -1]
    case 'week': {
      const mondayOffset = -((new Date().getDay() + 6) % 7)
      return [mondayOffset, mondayOffset + 6]
    }
    case 'next7':
      return [0, 6]
    case 'past7':
    case 'last7':
      return [-6, 0]
    case 'last30':
      return [-29, 0]
    default:
      return null
  }
}

/** The range as ISO instants (local days), for the server's date / created filters. Empty = no limit. */
export function rangeBounds(range: MeetingRangeValue): { from?: string; to?: string } {
  const days = presetDays(range.preset)
  if (days) return { from: dayStart(days[0]).toISOString(), to: dayEnd(days[1]).toISOString() }
  if (range.preset === 'custom') {
    return {
      from: range.from ? new Date(`${range.from}T00:00:00`).toISOString() : undefined,
      to: range.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : undefined,
    }
  }
  return {}
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtYmd(ymd: string): string {
  return fmtDay(new Date(`${ymd}T00:00:00`))
}

/** The plain sentence next to the buttons, e.g. "Meetings happening today (Mon, 16 Nov)". */
export function describeRange(range: MeetingRangeValue): string {
  const verb = range.basis === 'meeting' ? 'happening' : 'created'
  const days = presetDays(range.preset)
  if (days) {
    const [a, b] = days
    const label = RANGE_PRESETS[range.basis].find((p) => p.value === range.preset)?.label.toLowerCase() ?? ''
    const span = a === b ? fmtDay(dayStart(a)) : `${fmtDay(dayStart(a))} – ${fmtDay(dayStart(b))}`
    // "today" / "tomorrow" / "this week" read as they are; "next 7 days" etc. need "in the".
    const when = ['next7', 'past7', 'last7', 'last30'].includes(range.preset) ? `in the ${label}` : label
    return `Meetings ${verb} ${when} (${span})`
  }
  if (range.preset === 'custom' && (range.from || range.to)) {
    if (range.from && range.to) return `Meetings ${verb} from ${fmtYmd(range.from)} to ${fmtYmd(range.to)}`
    return range.from ? `Meetings ${verb} from ${fmtYmd(range.from)} onwards` : `Meetings ${verb} up to ${fmtYmd(range.to)}`
  }
  return range.basis === 'meeting' ? 'All meetings, past and upcoming' : 'Meetings created at any time'
}

/** The first stat card's label: "Today" for today's meetings, "Created" on the created-on basis, else "All". */
export function allCardFor(range: MeetingRangeValue): { label: string; hint: string } {
  if (range.basis === 'created') return { label: 'Created', hint: 'All meetings in range' }
  if (range.preset === 'today') return { label: 'Today', hint: 'All meetings scheduled today' }
  return { label: 'All', hint: 'All meetings in range' }
}
