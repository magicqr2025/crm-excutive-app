// Contacts tabs + the Filter panel's values, turned into the server's lead-list filters.
import type { LeadListFilters } from '@/api/crmApi'
import { FOLLOWUP_DATE_PRESETS, NO_DATE_RANGE, type FollowupDateRange } from '@/features/followups/followupDateFilter'

export type ContactsTab = 'all' | 'unassigned' | 'followup_today' | 'overdue' | 'meeting_today'

export const CONTACT_TABS: { value: ContactsTab; label: string }[] = [
  { value: 'all', label: 'All contacts' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'followup_today', label: 'Follow-up today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'meeting_today', label: 'Meeting today' },
]

/** What each tab adds on top of the Filter panel. The follow-up tabs win over the panel's Follow-up choice. */
export function tabQuery(tab: ContactsTab): { unassigned: boolean; filters: LeadListFilters } {
  switch (tab) {
    case 'unassigned':
      return { unassigned: true, filters: {} }
    case 'followup_today':
      return { unassigned: false, filters: { followup: 'today' } }
    case 'overdue':
      return { unassigned: false, filters: { followup: 'overdue' } }
    case 'meeting_today':
      return { unassigned: false, filters: { meeting: 'today' } }
    default:
      return { unassigned: false, filters: {} }
  }
}

export type FollowupChoice = '' | 'overdue' | 'today' | 'upcoming' | 'none'

export const FOLLOWUP_CHOICES: { value: Exclude<FollowupChoice, ''>; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'none', label: 'No follow-up' },
]

export interface ContactPanelFilters {
  followup: FollowupChoice
  leadStatusId: string
  campaignId: string
  labelId: string
  added: FollowupDateRange
}

export const NO_CONTACT_FILTERS: ContactPanelFilters = { followup: '', leadStatusId: '', campaignId: '', labelId: '', added: NO_DATE_RANGE }

export function hasFollowupTab(tab: ContactsTab): boolean {
  return tab === 'followup_today' || tab === 'overdue'
}

/** Panel values + tab → the server filters (YYYY-MM-DD "Added" days become local-day ISO bounds). */
export function toLeadFilters(panel: ContactPanelFilters, tab: ContactsTab): LeadListFilters {
  const { from, to } = panel.added
  return {
    ...(panel.followup && !hasFollowupTab(tab) ? { followup: panel.followup } : {}),
    ...(panel.leadStatusId ? { leadStatusId: panel.leadStatusId } : {}),
    ...(panel.campaignId ? { campaignId: panel.campaignId } : {}),
    ...(panel.labelId ? { labelId: panel.labelId } : {}),
    ...(from ? { createdFrom: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { createdTo: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    ...tabQuery(tab).filters,
  }
}

export function activeFilterCount(panel: ContactPanelFilters): number {
  return [panel.followup, panel.leadStatusId, panel.campaignId, panel.labelId, panel.added.from || panel.added.to].filter(Boolean).length
}

function dmy(value: string): string {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

/** Chip text for the "Added" range, e.g. "Added: This week". */
export function describeAdded(range: FollowupDateRange): string {
  const preset = FOLLOWUP_DATE_PRESETS.find((p) => p.value === range.preset)
  if (preset && range.preset !== 'custom') return `Added: ${preset.label}`
  if (range.from && range.to) return range.from === range.to ? `Added: ${dmy(range.from)}` : `Added: ${dmy(range.from)} – ${dmy(range.to)}`
  return range.from ? `Added: from ${dmy(range.from)}` : `Added: up to ${dmy(range.to)}`
}
