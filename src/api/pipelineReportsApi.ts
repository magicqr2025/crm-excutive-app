// Read-only pipeline reports. Same data as orm-whatsapp's Call Logs and Campaign Performance pages.
import type { CrmFollowup, CrmLead } from '@/api/crmApi'
import { apiRequest, apiRequestWithMeta } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { toPageResult, type PageResult } from '@/lib/paging'
import { useAuthStore } from '@/store/useAuthStore'

export type CallResult = 'connected' | 'not_connected' | 'unreviewed'

export interface TeamCall {
  id: string
  staff_name: string | null
  lead_id: string | null
  contact_name: string | null
  contact_phone: string | null
  lead_status: string | null
  /** null = synced from a phone, with no notes filed yet. */
  outcome: 'connected' | 'not_connected' | null
  reason: string | null
  remark: string | null
  duration_seconds: number | null
  call_type: 'incoming' | 'outgoing' | 'missed' | null
  followup_date: string | null
  followup_time: string | null
  occurred_at: string
}

export interface CallStaffRow {
  staff_id: string | null
  staff_name: string
  calls: number
  connected: number
  not_connected: number
  total_seconds: number
  last_call_at: string | null
}

export interface CallSummary {
  totals: { calls: number; connected: number; not_connected: number; unreviewed: number; total_seconds: number }
  by_staff: CallStaffRow[]
}

export interface CallFilters {
  staffId: string
  /** YYYY-MM-DD, inclusive; the server takes both or neither. */
  from: string
  to: string
  result: CallResult | ''
  search: string
}

export const CALLS_PER_PAGE = 25

export async function fetchTeamCalls(pipelineId: string, filters: CallFilters, page: number): Promise<PageResult<TeamCall>> {
  const query = new URLSearchParams({ campaign_id: pipelineId, page: String(page), per_page: String(CALLS_PER_PAGE) })
  if (filters.staffId) query.set('staff_id', filters.staffId)
  if (filters.from && filters.to) {
    query.set('from', filters.from)
    query.set('to', filters.to)
  }
  if (filters.result) query.set('outcome', filters.result)
  if (filters.search) query.set('search', filters.search)
  const result = await apiRequestWithMeta<TeamCall[], { summary?: CallSummary }>(`/crm/call-log/team?${query}`, { headers: crmSessionAuthHeaders() })
  // The shared list type expects a summary of plain numbers; the page reads this one back as CallSummary.
  return { ...toPageResult(result.data, result.meta), summary: result.summary as unknown as Record<string, number> | undefined }
}

/** Every open follow-up the viewer may see. */
export function fetchOpenFollowups(): Promise<CrmFollowup[]> {
  const query = new URLSearchParams({ business_id: useAuthStore.getState().activeBusinessId ?? '', status: 'active' })
  return apiRequest<CrmFollowup[]>(`/crm/followup/list?${query}`, { headers: crmSessionAuthHeaders() })
}

/** Every lead in one pipeline, whoever owns it. */
export function fetchPipelineLeads(pipelineId: string): Promise<CrmLead[]> {
  const query = new URLSearchParams({ business_id: useAuthStore.getState().activeBusinessId ?? '', lead_campaign_id: pipelineId })
  return apiRequest<CrmLead[]>(`/crm/cust-res/get-list?${query}`, { headers: crmSessionAuthHeaders() })
}

/** Every lead of the business (or one person's): the performance report counts them in the browser. */
export function fetchReportLeads(staffId: string): Promise<CrmLead[]> {
  const query = new URLSearchParams({ business_id: useAuthStore.getState().activeBusinessId ?? '' })
  if (staffId) query.set('assign_to_staff_id', staffId)
  return apiRequest<CrmLead[]>(`/crm/cust-res/get-list?${query}`, { headers: crmSessionAuthHeaders() })
}
