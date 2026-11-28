// Admin actions on contacts and the lists behind them. Same endpoints as orm-whatsapp.
import type { LeadFlag } from '@/api/crmApi'
import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { useAuthStore } from '@/store/useAuthStore'

const businessId = () => useAuthStore.getState().activeBusinessId ?? ''

function send<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method, headers: crmSessionAuthHeaders(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}

const get = <T>(path: string) => apiRequest<T>(path, { headers: crmSessionAuthHeaders() })
const id = (value: string) => encodeURIComponent(value)

// ---- Bulk actions on selected contacts (lead ids) ----

export const bulkAssignStaff = (leadIds: string[], staffId: string) =>
  send<{ updated_count: number }>('/crm/cust-res/bulk-assign', 'PUT', { business_id: businessId(), lead_ids: leadIds, assign_to_staff_id: staffId })

export const bulkSetStatus = (leadIds: string[], statusId: string) =>
  send<{ updated_count: number; skipped_count: number }>('/crm/cust-res/bulk-status', 'PUT', { business_id: businessId(), lead_ids: leadIds, lead_status_id: statusId })

export const bulkAddLabels = (leadIds: string[], labelIds: string[]) =>
  send<{ labelled: number; already_had: number; not_found: number }>('/crm/labels/bulk-assign', 'POST', { lead_ids: leadIds, label_ids: labelIds })

export const removeFromGroup = (groupId: string, leadIds: string[]) =>
  send<{ removed: number }>(`/crm/contact-groups/${id(groupId)}/remove-leads`, 'POST', { lead_ids: leadIds })

// ---- Import ----

/** Like Add New Lead, but with no pipeline: the server doesn't require one. */
export const importLead = (input: { name: string; phone: string; countryCode?: string; email?: string; leadStatusId?: string }) =>
  send<{ id: string }>('/lead/create', 'POST', {
    business_id: businessId(),
    name: input.name,
    phone: input.phone,
    ...(input.countryCode ? { country_code: input.countryCode } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.leadStatusId ? { lead_status_id: input.leadStatusId } : {}),
  })

// ---- Labels ----

export const addLabels = (names: string[]) =>
  send<{ id: string; name: string; created?: boolean }[]>('/crm/labels/bulk-add', 'POST', { business_id: businessId(), names })

export const renameLabel = (labelId: string, name: string) => send<unknown>(`/crm/labels/${id(labelId)}`, 'PUT', { name })

export const deleteLabel = (labelId: string) => send<{ removed_from_contacts: number }>(`/crm/labels/${id(labelId)}`, 'DELETE')

// ---- Contact groups ----

export interface Group {
  id: string
  name: string
  color: string
  description?: string | null
  member_count?: number
}

export interface GroupInput {
  name: string
  description: string | null
  color: string
}

export const fetchGroups = () => get<Group[]>('/crm/contact-groups/list')
export const createGroup = (input: GroupInput) => send<Group>('/crm/contact-groups/add', 'POST', input)
export const updateGroup = (groupId: string, input: GroupInput) => send<Group>(`/crm/contact-groups/${id(groupId)}`, 'PUT', input)
export const deleteGroup = (groupId: string) => send<unknown>(`/crm/contact-groups/${id(groupId)}`, 'DELETE')

// ---- Call flags ----

export interface Flag extends LeadFlag {
  lead_count?: number
  /** A deleted flag stays in the list while leads still carry it. */
  deleted?: boolean
}

export const fetchFlags = () => get<Flag[]>('/crm/lead-flags/list')
export const createFlag = (input: { name: string; color: string }) => send<Flag>('/crm/lead-flags/add', 'POST', input)
export const updateFlag = (flagId: string, input: { name?: string; color?: string; active?: boolean }) => send<Flag>(`/crm/lead-flags/${id(flagId)}`, 'PUT', input)
export const deleteFlag = (flagId: string) => send<unknown>(`/crm/lead-flags/${id(flagId)}`, 'DELETE')

// ---- Lead statuses ----

export interface StatusInput {
  name: string
  color: string
  sequence: number
  stageId: string
}

export const createStatus = (input: StatusInput) =>
  send<unknown>('/crm/lead-status/add', 'POST', {
    business_id: businessId(),
    lead_status: input.name,
    color: input.color,
    sequence: input.sequence,
    stage_id: input.stageId,
  })

export const updateStatus = (statusId: string, patch: Partial<StatusInput> & { active?: boolean; isDefault?: boolean }) =>
  send<unknown>('/crm/lead-status/update', 'PUT', {
    id: statusId,
    ...(patch.name === undefined ? {} : { lead_status: patch.name }),
    ...(patch.color === undefined ? {} : { color: patch.color }),
    ...(patch.sequence === undefined ? {} : { sequence: patch.sequence }),
    ...(patch.stageId === undefined ? {} : { stage_id: patch.stageId }),
    ...(patch.active === undefined ? {} : { status: patch.active ? '1' : '0' }),
    ...(patch.isDefault === undefined ? {} : { is_default: patch.isDefault }),
  })
