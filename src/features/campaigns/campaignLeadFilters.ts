// Filters for a pipeline's leads list (CampaignLeadsPage), same choices as the
// main CRM's pipeline Leads filter (orm-whatsapp LeadsFilterBar). They live in the
// page address so Back from a lead keeps them.

/** Staff filter value for "nobody has taken this lead yet". */
export const UNASSIGNED = '__unassigned__'
/** "The lead has none of these" for the id filters (the backend's `none`). */
export const NONE = 'none'

export type DatePreset = '' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'
export type FollowupFilter = 'overdue' | 'today' | 'upcoming' | 'none'
export type MeetingFilter = 'upcoming' | 'today' | 'missed' | 'completed' | 'none'

export interface CampaignLeadFilters {
  datePreset: DatePreset
  /** YYYY-MM-DD, only used when datePreset is "custom". */
  from: string
  to: string
  /** Admins only. */
  staffId: string
  stageId: string
  statusId: string
  labelId: string
  groupId: string
  productId: string
  flagId: string
  followup: '' | FollowupFilter
  meeting: '' | MeetingFilter
}

export const NO_LEAD_FILTERS: CampaignLeadFilters = {
  datePreset: '',
  from: '',
  to: '',
  staffId: '',
  stageId: '',
  statusId: '',
  labelId: '',
  groupId: '',
  productId: '',
  flagId: '',
  followup: '',
  meeting: '',
}

export const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
]

export const FOLLOWUP_OPTIONS: { value: '' | FollowupFilter; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'none', label: 'None' },
]

export const MEETING_OPTIONS: { value: '' | MeetingFilter; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'missed', label: 'Missed' },
  { value: 'completed', label: 'Completed' },
  { value: 'none', label: 'None' },
]

/** How many filters are on (Date counts once) — the Filter button's badge. */
export function activeFilterCount(f: CampaignLeadFilters): number {
  const keys = ['datePreset', 'staffId', 'stageId', 'statusId', 'labelId', 'groupId', 'productId', 'flagId', 'followup', 'meeting'] as const
  return keys.filter((k) => f[k]).length
}

/** Query-string key for each filter field. */
const URL_KEYS: Record<keyof CampaignLeadFilters, string> = {
  datePreset: 'date',
  from: 'from',
  to: 'to',
  staffId: 'staff',
  stageId: 'stage',
  statusId: 'status',
  labelId: 'label',
  groupId: 'group',
  productId: 'product',
  flagId: 'flag',
  followup: 'followup',
  meeting: 'meeting',
}

/** Reads the filters from the address; unknown choices are dropped rather than sent to the server. */
export function filtersFromParams(params: URLSearchParams): CampaignLeadFilters {
  const value = { ...NO_LEAD_FILTERS }
  for (const [field, key] of Object.entries(URL_KEYS) as [keyof CampaignLeadFilters, string][]) {
    const v = params.get(key)
    if (v) (value as Record<string, string>)[field] = v
  }
  if (!DATE_OPTIONS.some((o) => o.value === value.datePreset)) value.datePreset = ''
  if (value.datePreset !== 'custom') {
    value.from = ''
    value.to = ''
  }
  if (!FOLLOWUP_OPTIONS.some((o) => o.value === value.followup)) value.followup = ''
  if (!MEETING_OPTIONS.some((o) => o.value === value.meeting)) value.meeting = ''
  return value
}

/** Writes the filters into a copy of `params`, leaving other keys (the search) alone. */
export function filtersToParams(value: CampaignLeadFilters, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const [field, key] of Object.entries(URL_KEYS) as [keyof CampaignLeadFilters, string][]) {
    const v = value[field]
    if (v) next.set(key, v)
    else next.delete(key)
  }
  return next
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/** The lead-created window for a filter, in the viewer's time zone, as ISO instants. */
export function createdRangeFor(value: CampaignLeadFilters, now = new Date()): { createdFrom?: string; createdTo?: string } {
  const today = startOfDay(now)
  switch (value.datePreset) {
    case 'today':
      return { createdFrom: today.toISOString(), createdTo: endOfDay(now).toISOString() }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { createdFrom: y.toISOString(), createdTo: endOfDay(y).toISOString() }
    }
    case 'this_week': {
      // Weeks start on Monday.
      const monday = new Date(today)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      return { createdFrom: monday.toISOString(), createdTo: endOfDay(now).toISOString() }
    }
    case 'this_month':
      return { createdFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), createdTo: endOfDay(now).toISOString() }
    case 'custom':
      return {
        createdFrom: value.from ? new Date(`${value.from}T00:00:00`).toISOString() : undefined,
        createdTo: value.to ? new Date(`${value.to}T23:59:59.999`).toISOString() : undefined,
      }
    default:
      return {}
  }
}
