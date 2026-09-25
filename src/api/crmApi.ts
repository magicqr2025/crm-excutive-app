import { ApiError, apiRequest, apiRequestWithMeta } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { PAGE_SIZE, toPageResult, type PageResult } from '@/lib/paging'
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
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId })
  return apiRequest<CrmMyLeadCampaign[]>(`/crm/lead-campaigns/get-list?${params}`, { headers: authHeaders() })
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
  assign_to_staff_id?: string | null
  assign_staff_name: string | null
  discussion: string | null
  followup_date: string | null
  followup_time: string | null
  followup_status: '0' | '1' | '2'
  deal_value: string | null
  deal_details: string | null
  lead_campaigns: { id: string; name: string }[]
  created_at: string
}

// scope 'campaign' = every lead in the campaign, including other executives'
// (read-only team view; backend requires you to be an agent on the campaign).
export type CampaignLeadScope = 'mine' | 'campaign'

export async function fetchLeadsForCampaignPage(opts: { campaignId: string; staffId: string; scope: CampaignLeadScope; page: number; search?: string }): Promise<PageResult<CrmLead>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    lead_campaign_id: opts.campaignId,
    assign_to_staff_id: opts.staffId,
    scope: opts.scope,
    page: String(opts.page),
    per_page: String(PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
  })
  const result = await apiRequestWithMeta<CrmLead[]>(`/crm/cust-res/get-list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
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

// One page of the Contacts list (the caller's own leads plus the unassigned
// pool they may claim). `search` matches name/phone/email server-side;
// `unassigned` limits to the Unassigned tab. `perPage` 1 is also how the tab
// counts are read: only meta.total is used.
export async function fetchLeadsPage(opts: { staffId: string; page: number; search?: string; unassigned?: boolean; perPage?: number }): Promise<PageResult<CrmLead>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    assign_to_staff_id: opts.staffId,
    page: String(opts.page),
    per_page: String(opts.perPage ?? PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.unassigned ? { unassigned: '1' } : {}),
  })
  const result = await apiRequestWithMeta<CrmLead[]>(`/crm/cust-res/get-list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

// One lead the caller can see (own or unassigned pool); 404 otherwise.
export async function fetchLeadById(leadId: string): Promise<CrmLead> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId })
  return apiRequest<CrmLead>(`/crm/cust-res/get/${encodeURIComponent(leadId)}?${params}`, { headers: authHeaders() })
}

// Takes an unassigned lead for the calling executive (409 naming the owner if
// someone else got it first). See crmbackend's POST /crm/cust-res/claim.
export async function claimLead(leadId: string): Promise<CrmLead> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmLead>('/crm/cust-res/claim', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ business_id: businessId, lead_id: leadId }),
  })
}

// ---- Add New Lead ----
// crmbackend always assigns an executive's new lead to themselves and requires
// a campaign they're an agent on — so there's no assignee to send.

export interface QuickCreateLeadInput {
  name: string
  phone: string
  countryCode?: string
  email?: string
  leadStatusId?: string
  leadCampaignId: string
}

export async function quickCreateLead(input: QuickCreateLeadInput): Promise<CrmLead> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmLead>('/lead/create', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      name: input.name,
      phone: input.phone,
      ...(input.countryCode ? { country_code: input.countryCode } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.leadStatusId ? { lead_status_id: input.leadStatusId } : {}),
      lead_campaign_id: input.leadCampaignId,
    }),
  })
}

// A duplicate phone comes back as a 409 whose `errors[0]` says who owns the
// existing lead. `lead_id` is null when it belongs to another executive.
export interface DuplicateLeadInfo {
  owner: 'me' | 'unassigned' | 'other'
  assignee_name: string | null
  lead_id: string | null
}

export function duplicateLeadInfo(error: unknown): DuplicateLeadInfo | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const info = error.errors[0] as Partial<DuplicateLeadInfo> | undefined
  return info?.owner ? { owner: info.owner, assignee_name: info.assignee_name ?? null, lead_id: info.lead_id ?? null } : null
}

export interface UpdateLeadInput {
  discussion?: string
}

export async function updateLead(id: string, patch: UpdateLeadInput): Promise<CrmLead> {
  return apiRequest<CrmLead>(`/crm/cust-res/update?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  })
}

// ---- Lead activity log ----
// Every discussion save on a lead (`updateLead` with `discussion` set) is
// appended here server-side as a `kind: "discussion"` entry (see crmbackend's
// leads.controller.js) — `Lead.discussion` itself only ever holds the latest
// value, so this is the only place a full discussion history can be read
// from.

export interface CrmActivityEntry {
  id: string
  kind: string
  summary: string
  created_at: string
}

export async function fetchLeadActivity(leadId: string): Promise<CrmActivityEntry[]> {
  const params = new URLSearchParams({ lead_id: leadId })
  return apiRequest<CrmActivityEntry[]>(`/crm/activity-log/lead-list?${params}`, { headers: authHeaders() })
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
// A single call_logs table serves two flows, distinguished by `source`:
// "manual" is the staff-submitted disposition form below (lead_id/outcome
// always set); "device_sync" is an Android call auto-synced by
// syncDeviceCallLog (lead_id resolved server-side by phone match if any,
// outcome always null — nothing's been reviewed yet).

export type CallOutcome = 'connected' | 'not_connected'
export type DeviceCallType = 'incoming' | 'outgoing' | 'missed'
export type CallLogSource = 'manual' | 'device_sync'

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
  lead_id: string | null
  contact_name: string | null
  contact_phone: string | null
  outcome: CallOutcome | null
  reason: string | null
  lead_status_id: string | null
  remark: string | null
  duration_seconds: number | null
  followup_date: string | null
  followup_time: string | null
  source: CallLogSource
  phone_number: string | null
  call_type: DeviceCallType | null
  call_time: string | null
  device_call_id: string | null
  created_at: string
}

export interface CrmCallLogResult {
  call_log: CrmCallLog
  lead: CrmLead | null
}

export async function createCallLog(input: CreateCallLogInput): Promise<CrmCallLogResult> {
  const businessId = getActiveBusinessId()
  const staffId = useAuthStore.getState().user?.id
  return apiRequest<CrmCallLogResult>('/crm/call-log/create', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      lead_id: input.leadId,
      ...(staffId ? { staff_id: staffId } : {}),
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

export async function fetchMyCallLogsPage(opts: { staffId: string; page: number; search?: string }): Promise<PageResult<CrmCallLog>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    staff_id: opts.staffId,
    page: String(opts.page),
    per_page: String(PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
  })
  const result = await apiRequestWithMeta<CrmCallLog[]>(`/crm/call-log/list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

// ---- Device call log sync (Android only) ----
// business_id/staff_id are resolved server-side from the session token, not
// sent here — see crmbackend's callLog.controller.js syncHandler. Synced
// rows land in the same call_logs table fetchMyCallLogs already reads
// (source: "device_sync"), so there's no separate list endpoint. A number
// that matches no CRM lead is a personal call: the server skips it and
// returns null, so it never appears in Call Logs.

export interface SyncDeviceCallLogInput {
  phoneNumber: string
  callType: DeviceCallType
  callTime: string
  durationSeconds?: number
  deviceCallId: string
}

export async function syncDeviceCallLog(input: SyncDeviceCallLogInput): Promise<CrmCallLog | null> {
  return apiRequest<CrmCallLog | null>('/crm/call-log/sync', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      phone_number: input.phoneNumber,
      call_type: input.callType,
      call_time: input.callTime,
      ...(input.durationSeconds !== undefined ? { duration_seconds: input.durationSeconds } : {}),
      device_call_id: input.deviceCallId,
    }),
  })
}

// ---- Follow-ups ----

export interface CrmFollowup {
  id: string
  contact_id: string
  contact_name: string | null
  contact_phone: string | null
  lead_id: string | null
  followup_date: string
  followup_time: string
  followup_status: '0' | '1' | '2'
}

export async function fetchMyActiveFollowupsPage(opts: { staffId: string; page: number; search?: string }): Promise<PageResult<CrmFollowup>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    assign_to_staff_id: opts.staffId,
    page: String(opts.page),
    per_page: String(PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
  })
  const result = await apiRequestWithMeta<CrmFollowup[]>(`/crm/followup/followups/active?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

export async function fetchFollowupById(id: string): Promise<CrmFollowup> {
  return apiRequest<CrmFollowup>(`/crm/followup/get/${encodeURIComponent(id)}`, { headers: authHeaders() })
}

export async function fetchCallLogsForLead(leadId: string): Promise<CrmCallLog[]> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, lead_id: leadId })
  return apiRequest<CrmCallLog[]>(`/crm/call-log/list?${params}`, { headers: authHeaders() })
}

// ---- Contacts (used to pick who a deal/meeting/payment is for) ----

export interface CrmContact {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export async function searchContacts(search: string): Promise<CrmContact[]> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, ...(search ? { search } : {}) })
  const result = await apiRequestWithMeta<CrmContact[]>(`/crm/contacts/list?${params}`, { headers: authHeaders() })
  return result.data
}

// ---- Deals ----

export type DealStatus = 'accepted' | 'canceled' | 'created'

export interface CrmDeal {
  id: string
  /** The contact's latest lead, for linking to the contact page. */
  lead_id?: string | null
  deal_name: string
  deal_amount: number
  deal_details: string | null
  status: DealStatus
  contact_id: string
  contact_name: string | null
  created_at: string
}

export async function fetchDeals(contactId?: string): Promise<{ deals: CrmDeal[]; totalAmount: number }> {
  const businessId = getActiveBusinessId()
  const result = await apiRequestWithMeta<CrmDeal[], { summary?: { total_amount: number; count: number } }>(
    `/deal/list?business_id=${encodeURIComponent(businessId)}${contactId ? `&contact_id=${encodeURIComponent(contactId)}` : ''}`,
    { headers: authHeaders() },
  )
  return { deals: result.data, totalAmount: result.summary?.total_amount ?? 0 }
}

export async function fetchDealsPage(opts: { page: number; search?: string }): Promise<PageResult<CrmDeal>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, page: String(opts.page), per_page: String(PAGE_SIZE), ...(opts.search ? { search: opts.search } : {}) })
  const result = await apiRequestWithMeta<CrmDeal[], { summary?: { total_amount: number } }>(`/deal/list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta, { total_amount: result.summary?.total_amount ?? 0 })
}

export interface CreateDealInput {
  contactId: string
  dealName: string
  dealAmount: number
  dealDetails?: string
}

export async function createDeal(input: CreateDealInput): Promise<CrmDeal> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmDeal>('/deal/add', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      contact_id: input.contactId,
      deal_name: input.dealName,
      deal_amount: input.dealAmount,
      ...(input.dealDetails ? { deal_details: input.dealDetails } : {}),
    }),
  })
}

export interface UpdateDealInput {
  dealName?: string
  dealAmount?: number
  dealDetails?: string
  status?: DealStatus
}

export async function updateDeal(id: string, patch: UpdateDealInput): Promise<CrmDeal> {
  return apiRequest<CrmDeal>(`/deal/update/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      ...(patch.dealName !== undefined ? { deal_name: patch.dealName } : {}),
      ...(patch.dealAmount !== undefined ? { deal_amount: patch.dealAmount } : {}),
      ...(patch.dealDetails !== undefined ? { deal_details: patch.dealDetails } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }),
  })
}

// ---- Meetings ----

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled'

export interface CrmMeeting {
  id: string
  lead_id?: string | null
  contact_id: string
  contact_name: string | null
  assign_to_staff_id: string | null
  meeting_time: string
  meeting_type: string | null
  meeting_status: MeetingStatus
  meeting_link: string | null
  pricing: number
  meeting_summary: string | null
  created_at: string
}

export async function fetchMeetings(contactId?: string): Promise<CrmMeeting[]> {
  const businessId = getActiveBusinessId()
  const contactParam = contactId ? `&contact_id=${encodeURIComponent(contactId)}` : ''
  const result = await apiRequestWithMeta<CrmMeeting[]>(`/crm/meetings/list?business_id=${encodeURIComponent(businessId)}${contactParam}`, {
    headers: authHeaders(),
  })
  return result.data
}

export async function fetchMeetingsPage(opts: { page: number; search?: string }): Promise<PageResult<CrmMeeting>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, page: String(opts.page), per_page: String(PAGE_SIZE), ...(opts.search ? { search: opts.search } : {}) })
  const result = await apiRequestWithMeta<CrmMeeting[]>(`/crm/meetings/list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

export interface CreateMeetingInput {
  contactId: string
  meetingTime: string
  meetingType?: string
  meetingLink?: string
  meetingSummary?: string
  pricing?: number
}

export async function createMeeting(input: CreateMeetingInput): Promise<CrmMeeting> {
  const businessId = getActiveBusinessId()
  const staffId = useAuthStore.getState().user?.id
  return apiRequest<CrmMeeting>('/crm/meetings/add', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      contact_id: input.contactId,
      meeting_time: new Date(input.meetingTime).toISOString(),
      ...(staffId ? { assign_to_staff_id: staffId } : {}),
      ...(input.meetingType ? { meeting_type: input.meetingType } : {}),
      ...(input.meetingLink ? { meeting_link: input.meetingLink } : {}),
      ...(input.meetingSummary ? { meeting_summary: input.meetingSummary } : {}),
      ...(input.pricing !== undefined ? { pricing: input.pricing } : {}),
    }),
  })
}

export interface UpdateMeetingInput {
  meetingTime?: string
  meetingStatus?: MeetingStatus
  meetingLink?: string
  pricing?: number
  meetingSummary?: string
}

export async function updateMeeting(id: string, patch: UpdateMeetingInput): Promise<CrmMeeting> {
  return apiRequest<CrmMeeting>(`/crm/meetings/update/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      ...(patch.meetingTime !== undefined ? { meeting_time: new Date(patch.meetingTime).toISOString() } : {}),
      ...(patch.meetingStatus !== undefined ? { meeting_status: patch.meetingStatus } : {}),
      ...(patch.meetingLink !== undefined ? { meeting_link: patch.meetingLink } : {}),
      ...(patch.pricing !== undefined ? { pricing: patch.pricing } : {}),
      ...(patch.meetingSummary !== undefined ? { meeting_summary: patch.meetingSummary } : {}),
    }),
  })
}

// ---- Payments ----

export interface CrmPayment {
  id: string
  lead_id?: string | null
  contact_id: string
  contact_name: string | null
  amount: number
  currency: string
  mop: string
  assign_to_staff_id: string | null
  status: 0 | 1
  notes: string | null
  payment_date: string | null
  created_at: string
}

export async function fetchPayments(contactId?: string): Promise<{ payments: CrmPayment[]; successAmount: number }> {
  const businessId = getActiveBusinessId()
  const result = await apiRequestWithMeta<CrmPayment[], { summary?: { success_amount: number } }>(
    `/crm/payment/list?business_id=${encodeURIComponent(businessId)}${contactId ? `&contact_id=${encodeURIComponent(contactId)}` : ''}`,
    { headers: authHeaders() },
  )
  return { payments: result.data, successAmount: result.summary?.success_amount ?? 0 }
}

export async function fetchPaymentsPage(opts: { page: number; search?: string }): Promise<PageResult<CrmPayment>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, page: String(opts.page), per_page: String(PAGE_SIZE), ...(opts.search ? { search: opts.search } : {}) })
  const result = await apiRequestWithMeta<CrmPayment[], { summary?: { success_amount: number } }>(`/crm/payment/list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta, { success_amount: result.summary?.success_amount ?? 0 })
}

export interface CreatePaymentInput {
  contactId: string
  amount: number
  currency: string
  mop: string
  notes?: string
  paymentDate?: string
}

export async function createPayment(input: CreatePaymentInput): Promise<CrmPayment> {
  const businessId = getActiveBusinessId()
  const staffId = useAuthStore.getState().user?.id
  return apiRequest<CrmPayment>('/crm/payment/add', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      contact_id: input.contactId,
      amount: input.amount,
      currency: input.currency,
      mop: input.mop,
      ...(input.paymentDate ? { payment_date: input.paymentDate } : {}),
      ...(staffId ? { assign_to_staff_id: staffId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  })
}

// The backend's PUT /crm/payment/update/:id only accepts `amount` and
// `status` (payments.schema.js) — method/notes/date aren't editable there.
export interface UpdatePaymentInput {
  amount?: number
  status?: 0 | 1
}

export async function updatePayment(id: string, patch: UpdatePaymentInput): Promise<CrmPayment> {
  return apiRequest<CrmPayment>(`/crm/payment/update/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }),
  })
}
