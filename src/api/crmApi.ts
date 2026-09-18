import { apiRequest, apiRequestWithMeta } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { useAuthStore } from '@/store/useAuthStore'

function authHeaders(): HeadersInit {
  return crmSessionAuthHeaders()
}

function getActiveBusinessId(): string {
  const id = useAuthStore.getState().activeBusinessId
  if (!id) throw new Error('No active business')
  return id
}

// ---- My Campaigns ----

export interface CrmMyLeadCampaign {
  id: string
  name: string
  is_paused: boolean
  priority: 'low' | 'medium' | 'high'
  lead_count: number
  assigned: number
  uncontacted: number
  in_progress: number
  closed: number
  unassigned: number
  created_at: string
}

export async function fetchMyLeadCampaigns(): Promise<CrmMyLeadCampaign[]> {
  return apiRequest<CrmMyLeadCampaign[]>('/crm/lead-campaigns/my-list', { headers: authHeaders() })
}

// ---- Leads within a campaign ----

export interface CrmLead {
  id: string
  contact_id: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  lead_status: string | null
  lead_status_color: string | null
  tag_id: string | null
  tag_name: string | null
  assign_staff_name: string | null
  discussion: string | null
  followup_date: string | null
  followup_time: string | null
  followup_status: '0' | '1' | '2'
  deal_value: string | null
  deal_details: string | null
  created_at: string
}

export async function fetchLeadsForCampaign(campaignId: string, staffId: string): Promise<CrmLead[]> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, lead_campaign_id: campaignId, assign_to_staff_id: staffId })
  const result = await apiRequestWithMeta<CrmLead[]>(`/crm/cust-res/get-list?${params}`, { headers: authHeaders() })
  return result.data
}

export async function fetchNextQueueLead(campaignId: string, staffId: string, excludeLeadId?: string): Promise<CrmLead | null> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    lead_campaign_id: campaignId,
    assign_to_staff_id: staffId,
    ...(excludeLeadId ? { exclude_lead_id: excludeLeadId } : {}),
  })
  return apiRequest<CrmLead | null>(`/crm/cust-res/next-in-queue?${params}`, { headers: authHeaders() })
}

// ---- Lead statuses / stage types (for the disposition form) ----

export interface CrmLeadStageType {
  id: string
  lead_stage: string
}

export async function fetchLeadStageTypes(): Promise<CrmLeadStageType[]> {
  return apiRequest<CrmLeadStageType[]>('/public/api/get-lead-stage-type-list')
}

export interface CrmLeadStatus {
  id: string
  lead_status: string
  stage_id: string
  sequence: number | null
  color: string | null
}

export async function fetchLeadStatuses(): Promise<CrmLeadStatus[]> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmLeadStatus[]>(`/crm/lead-status/get-list?business_id=${encodeURIComponent(businessId)}`, {
    headers: authHeaders(),
  })
}

// ---- Call log ----

export type CallOutcome = 'connected' | 'not_connected'

export interface CreateCallLogInput {
  leadId: string
  outcome: CallOutcome
  reason?: string
  leadStatusId?: string
  remark?: string
  durationSeconds?: number
  followupDate?: string
  followupTime?: string
}

export interface CrmCallLog {
  id: string
  lead_id: string
  outcome: CallOutcome
  reason: string | null
  lead_status_id: string | null
  remark: string | null
  duration_seconds: number | null
  followup_date: string | null
  followup_time: string | null
  created_at: string
}

export interface CrmCallLogResult {
  call_log: CrmCallLog
  lead: CrmLead | null
}

export async function createCallLog(input: CreateCallLogInput): Promise<CrmCallLogResult> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmCallLogResult>('/crm/call-log/create', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      lead_id: input.leadId,
      outcome: input.outcome,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.leadStatusId ? { lead_status_id: input.leadStatusId } : {}),
      ...(input.remark ? { remark: input.remark } : {}),
      ...(input.durationSeconds !== undefined ? { duration_seconds: input.durationSeconds } : {}),
      ...(input.followupDate ? { followup_date: input.followupDate } : {}),
      ...(input.followupTime ? { followup_time: input.followupTime } : {}),
    }),
  })
}

export async function fetchMyCallLogs(staffId: string): Promise<CrmCallLog[]> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, staff_id: staffId })
  return apiRequest<CrmCallLog[]>(`/crm/call-log/list?${params}`, { headers: authHeaders() })
}

// ---- Follow-ups ----

export interface CrmFollowup {
  id: string
  contact_id: string
  contact_name: string | null
  contact_phone: string | null
  followup_date: string
  followup_time: string
  followup_status: '0' | '1' | '2'
}

export async function fetchMyActiveFollowups(staffId: string): Promise<CrmFollowup[]> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, assign_to_staff_id: staffId })
  return apiRequest<CrmFollowup[]>(`/crm/followup/followups/active?${params}`, { headers: authHeaders() })
}
