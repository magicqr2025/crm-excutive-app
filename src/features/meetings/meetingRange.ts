// The "created on" range at the top of the Meetings page: it bounds the cards and the list alike.

export type CreatedPreset = 'today' | '7d' | '15d' | '30d' | 'all'

export const CREATED_PRESETS: { value: CreatedPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '15d', label: '15 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
]

// Default: meetings created in the last 7 days.
export const DEFAULT_CREATED_PRESET: CreatedPreset = '7d'

const PRESET_DAYS: Partial<Record<CreatedPreset, number>> = { today: 1, '7d': 7, '15d': 15, '30d': 30 }

/** Local-day start, as an ISO instant, for the server's created_from ('all' = no bound). */
export function createdFrom(preset: CreatedPreset): string | undefined {
  const days = PRESET_DAYS[preset]
  if (!days) return undefined
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (days - 1))
  return from.toISOString()
}

export function describeCreated(preset: CreatedPreset): string {
  if (preset === 'all') return 'created at any time'
  if (preset === 'today') return 'created today'
  return `created in the last ${PRESET_DAYS[preset]} days`
}
