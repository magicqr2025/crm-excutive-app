// Contacts tabs + the Filters popup's values (the same popup as a pipeline's leads list), turned into the server's
// lead-list query.
import type { LeadListFilters } from '@/api/crmApi'
import { UNASSIGNED, createdRangeFor, type CampaignLeadFilters } from '@/features/campaigns/campaignLeadFilters'

export type ContactsTab = 'all' | 'unassigned' | 'followup_today' | 'overdue' | 'meeting_today'

export const CONTACT_TABS: { value: ContactsTab; label: string }[] = [
  { value: 'all', label: 'All contacts' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'followup_today', label: 'Follow-up today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'meeting_today', label: 'Meeting today' },
]

/** What each tab adds on top of the Filters popup. A tab's follow-up / meeting choice wins over the popup's. */
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

export interface ContactsQuery {
  /** Whose leads; ignored when `allStaff`. */
  staffId: string
  allStaff: boolean
  unassigned: boolean
  filters: LeadListFilters
}

/**
 * Popup values + tab → the list request. An admin sees everyone's contacts unless they pick a user (or
 * Unassigned) in the popup; everyone else always sees their own plus the unassigned pool.
 */
export function contactsQuery(f: CampaignLeadFilters, tab: ContactsTab, userId: string, isAdmin: boolean): ContactsQuery {
  const tabPart = tabQuery(tab)
  const pickedStaff = isAdmin && f.staffId && f.staffId !== UNASSIGNED ? f.staffId : ''
  return {
    staffId: pickedStaff || userId,
    allStaff: isAdmin && !pickedStaff,
    unassigned: tabPart.unassigned || (isAdmin && f.staffId === UNASSIGNED),
    filters: {
      ...(f.campaignId ? { campaignId: f.campaignId } : {}),
      ...(f.stageId ? { stageId: f.stageId } : {}),
      ...(f.statusId ? { leadStatusId: f.statusId } : {}),
      ...(f.labelId ? { labelId: f.labelId } : {}),
      ...(f.groupId ? { groupId: f.groupId } : {}),
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.flagId ? { flagId: f.flagId } : {}),
      ...(f.followup ? { followup: f.followup } : {}),
      ...(f.meeting ? { meeting: f.meeting } : {}),
      ...createdRangeFor(f),
      ...tabPart.filters,
    },
  }
}
