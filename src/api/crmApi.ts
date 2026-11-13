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

// Call-status flags: sticky per-lead attributes a sales member raises from
// the Call Status dialog (DispositionForm) — set once, they stay true until
// someone explicitly clears them. `flag_note` is a single shared note, not
// per-flag. Mirrors orm-whatsapp's crmApi.ts (same crmbackend wire format).
export type CallStatusFlagKey = 'need_attention' | 'feature_requirement' | 'special_meeting' | 'premium_client'

export const CALL_STATUS_FLAG_LABELS: Record<CallStatusFlagKey, string> = {
  need_attention: 'Need Attention',
  feature_requirement: 'Feature Requirement',
  special_meeting: 'Special Meeting',
  premium_client: 'Premium Client',
}

export interface CrmLead {
  id: string
  contact_id: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_country_code?: string | null
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
  need_attention: boolean
  feature_requirement: boolean
  special_meeting: boolean
  premium_client: boolean
  flag_note: string | null
  flag_note_updated_at: string | null
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
    // An empty staff id means no staff filter: admins get everyone's leads, anyone else is still held to their own by the server.
    ...(opts.staffId ? { assign_to_staff_id: opts.staffId } : {}),
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
  /** Moves the lead to this status (a Lead Board column). */
  lead_status_id?: string
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
  needAttention?: boolean
  featureRequirement?: boolean
  specialMeeting?: boolean
  premiumClient?: boolean
  flagNote?: string
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
  // When the call happened (the list's sort key) — call_time for a synced call
  // or a disposition paired with one, else created_at.
  occurred_at: string
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
      ...(input.needAttention !== undefined ? { need_attention: input.needAttention } : {}),
      ...(input.featureRequirement !== undefined ? { feature_requirement: input.featureRequirement } : {}),
      ...(input.specialMeeting !== undefined ? { special_meeting: input.specialMeeting } : {}),
      ...(input.premiumClient !== undefined ? { premium_client: input.premiumClient } : {}),
      ...(input.flagNote !== undefined ? { flag_note: input.flagNote } : {}),
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
  /** Set while a manager's "raise priority" on this follow-up is still open. */
  raised?: CrmRaised | null
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

// The caller's active (pending/scheduled) follow-ups for one contact — the contact
// detail page's Follow-up tab. Non-admins are limited to their own by the server.
export async function fetchContactActiveFollowups(contactId: string): Promise<CrmFollowup[]> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, contact_id: contactId, status: 'active' })
  return apiRequest<CrmFollowup[]>(`/crm/followup/list?${params}`, { headers: authHeaders() })
}

export type FollowupTab = 'overdue' | 'upcoming' | 'done'

// The caller's follow-ups for one Follow-ups tab. Open ones (overdue = due before today IST,
// upcoming = today or later) come soonest first; done ones newest due date first.
export async function fetchMyFollowupsPage(opts: {
  staffId: string
  tab: FollowupTab
  page: number
  search?: string
  perPage?: number
}): Promise<PageResult<CrmFollowup>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    assign_to_staff_id: opts.staffId,
    page: String(opts.page),
    per_page: String(opts.perPage ?? PAGE_SIZE),
    ...(opts.tab === 'done' ? { status: 'done' } : { due: opts.tab }),
    ...(opts.search ? { search: opts.search } : {}),
  })
  const result = await apiRequestWithMeta<CrmFollowup[]>(`/crm/followup/list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

export async function markFollowupDone(id: string): Promise<CrmFollowup> {
  return apiRequest<CrmFollowup>(`/crm/followup/update/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ followup_status: '2' }),
  })
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
  product_id?: string | null
  product_name?: string | null
  status: DealStatus
  contact_id: string
  contact_name: string | null
  /** Money received, refunds and balance are derived from the payment ledger on the server. */
  paid_amount: number
  refunded_amount: number
  net_paid_amount: number
  balance_amount: number
  payment_status: DealPaymentStatus
  /** Why the deal isn't fully paid (set when a short payment is recorded). */
  short_payment_reason: string | null
  expected_balance_date: string | null
  created_at: string
}

export type DealPaymentStatus = 'unpaid' | 'partial' | 'paid'

export async function fetchDeals(contactId?: string): Promise<{ deals: CrmDeal[]; totalAmount: number }> {
  const businessId = getActiveBusinessId()
  const result = await apiRequestWithMeta<CrmDeal[], { summary?: { total_amount: number; count: number } }>(
    `/deal/list?business_id=${encodeURIComponent(businessId)}${contactId ? `&contact_id=${encodeURIComponent(contactId)}` : ''}`,
    { headers: authHeaders() },
  )
  return { deals: result.data, totalAmount: result.summary?.total_amount ?? 0 }
}

export async function fetchDealsPage(opts: { page: number; search?: string; paymentStatus?: DealPaymentStatus }): Promise<PageResult<CrmDeal>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    page: String(opts.page),
    per_page: String(PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.paymentStatus ? { payment_status: opts.paymentStatus } : {}),
  })
  const result = await apiRequestWithMeta<CrmDeal[], { summary?: { total_amount: number } }>(`/deal/list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta, { total_amount: result.summary?.total_amount ?? 0 })
}

export interface CrmProduct {
  id: string
  name: string
  selling_price: number
}

export async function fetchActiveProducts(): Promise<CrmProduct[]> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId(), status: 'active', per_page: '100' })
  return apiRequest<CrmProduct[]>(`/crm/products/list?${params}`, { headers: authHeaders() })
}

export interface CreateDealInput {
  productId?: string
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
      ...(input.productId ? { product_id: input.productId } : {}),
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

export type CancelReason = 'client_not_available' | 'rescheduled' | 'client_declined' | 'other'

export interface CrmMeetingAttendee {
  staff_id: string
  name: string
}

export interface CrmMeetingTask {
  id: string
  title: string
  status: TaskStatus
  deadline: string | null
}

export interface CrmMeetingLog {
  id: string
  kind: 'rescheduled'
  from_time: string | null
  to_time: string | null
  /** Null when the client moved it from their own booking link. */
  actor_id: string | null
  created_at: string
}

export interface CrmMeeting {
  id: string
  lead_id?: string | null
  contact_id: string
  contact_name: string | null
  contact_phone?: string | null
  contact_email?: string | null
  assign_to_staff_id: string | null
  meeting_time: string
  meeting_type: string | null
  /** Length in minutes (older meetings read as 30). */
  duration_minutes?: number
  customer_overview?: string | null
  /** 'booking' when a booking link made it (those can't be transferred or deleted). */
  source?: 'manual' | 'booking'
  booking_id?: string | null
  reschedule_count?: number
  logs?: CrmMeetingLog[]
  updated_at?: string
  meeting_status: MeetingStatus
  meeting_link: string | null
  pricing: number
  meeting_summary: string | null
  created_by: string | null
  cancel_reason: CancelReason | null
  cancel_remark: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  followup_id: string | null
  next_meeting_id: string | null
  attendees: CrmMeetingAttendee[]
  tasks: CrmMeetingTask[]
  reminder: MeetingReminder | null
  created_at: string
  raised?: CrmRaised | null
}

export async function fetchMeetings(contactId?: string): Promise<CrmMeeting[]> {
  const businessId = getActiveBusinessId()
  const contactParam = contactId ? `&contact_id=${encodeURIComponent(contactId)}` : ''
  const result = await apiRequestWithMeta<CrmMeeting[]>(`/crm/meetings/list?business_id=${encodeURIComponent(businessId)}${contactParam}`, {
    headers: authHeaders(),
  })
  return result.data
}

export type MeetingView = 'all' | 'upcoming' | 'completed' | 'overdue' | 'cancelled'

export interface MeetingsPageOpts {
  page: number
  search?: string
  /** Which stat card is selected; the response then carries a count for every card. */
  view?: MeetingView
  /** The caller's "now" (ISO): scheduled meetings at or after it are Upcoming, before it Overdue. */
  upcomingFrom?: string
  /** 'booking' = booked online, 'manual' = added by staff. */
  source?: 'booking' | 'manual'
  /** ISO instants bounding when the meeting was created. */
  createdFrom?: string
  createdTo?: string
}

export async function fetchMeetingsPage(opts: MeetingsPageOpts): Promise<PageResult<CrmMeeting>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    page: String(opts.page),
    per_page: String(PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.view ? { view: opts.view } : {}),
    ...(opts.upcomingFrom ? { upcoming_from: opts.upcomingFrom } : {}),
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.createdFrom ? { created_from: opts.createdFrom } : {}),
    ...(opts.createdTo ? { created_to: opts.createdTo } : {}),
  })
  const result = await apiRequestWithMeta<CrmMeeting[]>(`/crm/meetings/list?${params}`, { headers: authHeaders() })
  // The per-card counts ride along as the page "summary".
  return toPageResult(result.data, result.meta, result.meta?.counts)
}

export async function fetchMeetingById(id: string): Promise<CrmMeeting> {
  return apiRequest<CrmMeeting>(`/crm/meetings/get/${encodeURIComponent(id)}`, { headers: authHeaders() })
}

export interface CreateMeetingInput {
  contactId: string
  meetingTime: string
  meetingType?: string
  /** Length in minutes (the server reads a missing one as 30). */
  durationMinutes?: number
  meetingLink?: string
  meetingSummary?: string
  pricing?: number
  reminder?: MeetingReminder
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
      ...(input.durationMinutes ? { duration_minutes: input.durationMinutes } : {}),
      ...(input.meetingLink ? { meeting_link: input.meetingLink } : {}),
      ...(input.meetingSummary ? { meeting_summary: input.meetingSummary } : {}),
      ...(input.pricing !== undefined ? { pricing: input.pricing } : {}),
      ...(input.reminder ? { reminder: input.reminder } : {}),
    }),
  })
}

export interface CompleteMeetingInput {
  meetingSummary: string
  /** Extra colleagues who attended; the meeting's assignee is always counted by the server. */
  attendeeStaffIds: string[]
  nextTask?: { title: string; deadline?: string; assignToStaffId?: string }
  followup?: {
    type: 'call' | 'meeting'
    date: string // YYYY-MM-DD
    time: string // HH:MM
    assignToStaffId?: string
    note?: string
  }
}

async function postMeetingAction(action: string, id: string, body: object): Promise<CrmMeeting> {
  return apiRequest<CrmMeeting>(`/crm/meetings/${action}/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
}

export function completeMeeting(id: string, input: CompleteMeetingInput): Promise<CrmMeeting> {
  return postMeetingAction('complete', id, {
    meeting_summary: input.meetingSummary,
    attendee_staff_ids: input.attendeeStaffIds,
    ...(input.nextTask
      ? {
          next_task: {
            title: input.nextTask.title,
            ...(input.nextTask.deadline ? { deadline: new Date(input.nextTask.deadline).toISOString() } : {}),
            ...(input.nextTask.assignToStaffId ? { assign_to_staff_id: input.nextTask.assignToStaffId } : {}),
          },
        }
      : {}),
    ...(input.followup
      ? {
          followup: {
            type: input.followup.type,
            date: input.followup.date,
            time: input.followup.time,
            // A meeting follow-up needs a real instant; date + time are the user's local wall-clock.
            ...(input.followup.type === 'meeting'
              ? { meeting_time: new Date(`${input.followup.date}T${input.followup.time}`).toISOString() }
              : {}),
            ...(input.followup.assignToStaffId ? { assign_to_staff_id: input.followup.assignToStaffId } : {}),
            ...(input.followup.note ? { note: input.followup.note } : {}),
          },
        }
      : {}),
  })
}

export function cancelMeeting(id: string, input: { reason: CancelReason; remark?: string }): Promise<CrmMeeting> {
  return postMeetingAction('cancel', id, {
    reason: input.reason,
    ...(input.remark ? { remark: input.remark } : {}),
  })
}

export function rescheduleMeeting(id: string, meetingTime: string): Promise<CrmMeeting> {
  return postMeetingAction('reschedule', id, { meeting_time: new Date(meetingTime).toISOString() })
}

export function transferMeeting(id: string, input: { toStaffId: string; remark: string }): Promise<CrmMeeting> {
  return postMeetingAction('transfer', id, { to_staff_id: input.toStaffId, remark: input.remark })
}

export interface UpdateMeetingDetailsInput {
  meetingLink?: string
  pricing?: number
  meetingSummary?: string
  /** null removes the client reminder email. */
  reminder?: MeetingReminder | null
}

// The only fields PUT /crm/meetings/update/:id still accepts; time, status and
// assignee go through reschedule / complete / cancel / transfer.
export async function updateMeetingDetails(id: string, patch: UpdateMeetingDetailsInput): Promise<CrmMeeting> {
  return apiRequest<CrmMeeting>(`/crm/meetings/update/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      ...(patch.meetingLink !== undefined ? { meeting_link: patch.meetingLink } : {}),
      ...(patch.pricing !== undefined ? { pricing: patch.pricing } : {}),
      ...(patch.meetingSummary !== undefined ? { meeting_summary: patch.meetingSummary } : {}),
      ...(patch.reminder !== undefined ? { reminder: patch.reminder } : {}),
    }),
  })
}

// ---- Monthly target (own only; the server limits staff to their own row) ----

export interface CrmStaffTarget {
  id: string
  staff_id: string
  target_month: number
  target_year: number
  target_amount: number
  /** Money actually received that month, net of refunds — computed on the server. */
  achieved_amount: number
  collected_from_earlier_months: number
  booked_amount: number
  pending_amount: number
}

export async function fetchMyTargets(): Promise<CrmStaffTarget[]> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmStaffTarget[]>(`/crm/staff-targets/list?business_id=${encodeURIComponent(businessId)}`, { headers: authHeaders() })
}

// ---- Payments ----

export interface CrmPayment {
  id: string
  lead_id?: string | null
  contact_id: string
  contact_name: string | null
  deal_id: string | null
  /** Set when the money was received for a subscription term. */
  subscription_id?: string | null
  subscription_name?: string | null
  /** A refund is its own ledger row (positive amount) that subtracts from totals. */
  kind: 'payment' | 'refund'
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

export interface PaymentFilters {
  search?: string
  month?: number
  year?: number
  mop?: string
  kind?: 'payment' | 'refund'
}

export async function fetchPaymentsPage(opts: PaymentFilters & { page: number }): Promise<PageResult<CrmPayment>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({ business_id: businessId, page: String(opts.page), per_page: String(PAGE_SIZE) })
  if (opts.search) params.set('search', opts.search)
  if (opts.month) params.set('month', String(opts.month))
  if (opts.year) params.set('year', String(opts.year))
  if (opts.mop) params.set('mop', opts.mop)
  if (opts.kind) params.set('kind', opts.kind)
  const result = await apiRequestWithMeta<CrmPayment[], { summary?: { success_amount: number; received_amount?: number; refunded_amount?: number } }>(
    `/crm/payment/list?${params}`,
    { headers: authHeaders() },
  )
  return toPageResult(result.data, result.meta, {
    success_amount: result.summary?.success_amount ?? 0,
    received_amount: result.summary?.received_amount ?? 0,
    refunded_amount: result.summary?.refunded_amount ?? 0,
  })
}

export interface CreatePaymentInput {
  contactId: string
  /** Link the money to a deal so balance, reason and target credit are tracked. */
  dealId?: string
  /** Log the money against a subscription instead of a deal. */
  subscriptionId?: string
  amount: number
  currency: string
  mop: string
  notes?: string
  paymentDate?: string
  /** Required by the server when the payment leaves a balance on the deal. */
  reason?: string
  expectedBalanceDate?: string
  /** Generated once per form; a retried submit replays the original payment instead of duplicating it. */
  clientRequestId?: string
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
      ...(input.dealId ? { deal_id: input.dealId } : {}),
      ...(input.subscriptionId ? { subscription_id: input.subscriptionId } : {}),
      amount: input.amount,
      currency: input.currency,
      mop: input.mop,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.expectedBalanceDate ? { expected_balance_date: input.expectedBalanceDate } : {}),
      ...(input.clientRequestId ? { client_request_id: input.clientRequestId } : {}),
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

export interface CreateFollowupInput {
  contactId: string
  assignToStaffId: string
  followupDate: string // YYYY-MM-DD, IST wall clock
  followupTime: string // HH:MM, IST wall clock
}

export async function createFollowup(input: CreateFollowupInput): Promise<CrmFollowup> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmFollowup>('/crm/followup/add', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      contact_id: input.contactId,
      assign_to_staff_id: input.assignToStaffId,
      followup_date: input.followupDate,
      followup_time: `${input.followupTime}:00`,
    }),
  })
}

// ---- Tasks ----

export type TaskStatus = 'created' | 'ongoing' | 'in_review' | 'completed' | 'cancelled'
/** A built-in key ('general' — the default, or an older fixed type) or the name of an admin-managed task type (a "project"). */
export type TaskType = string
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
/** List filter: a status, or 'open' = created + ongoing + in review. */
export type TaskStatusFilter = TaskStatus | 'open'

/** One checklist item on a task. */
export interface TaskSubtask {
  id: string
  title: string
  done: boolean
  done_at: string | null
}

export interface CrmTask {
  id: string
  contact_id: string | null
  contact_name: string | null
  meeting_id: string | null
  title: string
  task_type: TaskType
  priority: TaskPriority
  status: TaskStatus
  deadline: string | null
  assign_to_staff_id: string
  created_by: string | null
  raised?: CrmRaised | null
  /** Set when the task is moved to completed. */
  completed_at?: string | null
  /** Set when a completed task is marked closed. */
  closed_at?: string | null
  /** What the assignee did and how it works: rich text (sanitized HTML). */
  work_notes?: string | null
  work_notes_updated_at?: string | null
  /** Plain-text note added when the task was created or edited. */
  remark?: string | null
  /** Public https links of images attached to the task. */
  image_urls?: string[]
  /** Images the assignee attached while working. */
  work_image_urls?: string[]
  /** The checklist (empty for most tasks). */
  subtasks?: TaskSubtask[]
  created_at: string
  updated_at: string
}

// Colleagues a task can be assigned to. The backend's staff list has more
// fields; these are the ones the UI reads.
export interface StaffMember {
  user_id: string
  first_name: string | null
  last_name: string | null
  is_admin?: boolean
}

export interface CreateTaskInput {
  title: string
  taskType?: TaskType
  priority?: TaskPriority
  deadline?: string // datetime-local value or ISO
  assignToStaffId?: string
  contactId?: string
  remark?: string
  /** Public links of images already uploaded */
  imageUrls?: string[]
  /** Checklist items, in order */
  subtasks?: string[]
}

export interface UpdateTaskInput {
  title?: string
  taskType?: TaskType
  priority?: TaskPriority
  deadline?: string | null // null clears it
  assignToStaffId?: string
  /** The customer the task is about; null clears it */
  contactId?: string | null
  /** Empty string clears it */
  remark?: string
  /** Replaces the whole list */
  imageUrls?: string[]
  /** Only for a completed task; false reopens it */
  closed?: boolean
}

export async function fetchStaff(): Promise<StaffMember[]> {
  const businessId = getActiveBusinessId()
  return apiRequest<StaffMember[]>('/crm/users/get-list', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ business_id: businessId }),
  })
}

export async function fetchTasksPage(opts: {
  page: number
  search?: string
  status?: TaskStatusFilter
  taskType?: TaskType
  excludeTaskType?: TaskType
  assigneeId?: string
  contactId?: string
  perPage?: number
}): Promise<PageResult<CrmTask>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    page: String(opts.page),
    per_page: String(opts.perPage ?? PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.contactId ? { contact_id: opts.contactId } : {}),
    ...(opts.taskType ? { task_type: opts.taskType } : {}),
    ...(opts.excludeTaskType ? { exclude_task_type: opts.excludeTaskType } : {}),
    ...(opts.assigneeId ? { assign_to_staff_id: opts.assigneeId } : {}),
  })
  const result = await apiRequestWithMeta<CrmTask[]>(`/crm/tasks/list?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

export async function createTask(input: CreateTaskInput): Promise<CrmTask> {
  const businessId = getActiveBusinessId()
  return apiRequest<CrmTask>('/crm/tasks/add', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      title: input.title,
      ...(input.taskType ? { task_type: input.taskType } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.deadline ? { deadline: new Date(input.deadline).toISOString() } : {}),
      ...(input.assignToStaffId ? { assign_to_staff_id: input.assignToStaffId } : {}),
      ...(input.contactId ? { contact_id: input.contactId } : {}),
      ...(input.remark ? { remark: input.remark } : {}),
      ...(input.imageUrls?.length ? { image_urls: input.imageUrls } : {}),
      ...(input.subtasks?.length ? { subtasks: input.subtasks } : {}),
    }),
  })
}

/** What the assignee did, as rich text (the server cleans the HTML). null clears it. */
export async function saveTaskWorkNotes(id: string, workNotes: string | null): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/work-notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ work_notes: workNotes }),
  })
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/update/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.taskType !== undefined ? { task_type: patch.taskType } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.deadline !== undefined
        ? { deadline: patch.deadline === null ? null : new Date(patch.deadline).toISOString() }
        : {}),
      ...(patch.assignToStaffId !== undefined ? { assign_to_staff_id: patch.assignToStaffId } : {}),
      ...(patch.contactId !== undefined ? { contact_id: patch.contactId } : {}),
      ...(patch.remark !== undefined ? { remark: patch.remark } : {}),
      ...(patch.imageUrls !== undefined ? { image_urls: patch.imageUrls } : {}),
      ...(patch.closed !== undefined ? { closed: patch.closed } : {}),
    }),
  })
}

/** A plain status move ("created" only reopens a completed task). */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/status/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  })
}

// ---- My target ----

export interface CrmIncentiveSlab {
  from: number
  to: number
  rate: number
}

export interface CrmStaffTarget {
  id: string
  staff_id: string
  target_month: number
  target_year: number
  target_amount: number
  base_salary: number
  /** Money received that month, net of refunds — computed by the server. */
  achieved_amount: number
  collected_from_earlier_months: number
  booked_amount: number
  pending_amount: number
  incentive_slab: CrmIncentiveSlab[] | null
  /** Set when that month has no target of its own and the latest earlier one is reused. */
  carried_forward?: boolean
  carried_from_month?: number
  carried_from_year?: number
}

export async function fetchMyTarget(month: number, year: number): Promise<CrmStaffTarget | null> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId(), month: String(month), year: String(year) })
  const rows = await apiRequest<CrmStaffTarget[]>(`/crm/staff-targets/list?${params}`, { headers: authHeaders() })
  return rows.find((t) => t.target_month === month && t.target_year === year) ?? null
}

// ---- Email (ZeptoMail) ----
// An admin connects ZeptoMail and enables templates in orm-whatsapp; executives
// can only pick one of those templates and send it to a lead they can see.

/** Client reminder email chosen on a meeting: which template, and when (1 day and/or 1 hour before). */
export interface MeetingReminder {
  mapping_id: string
  remind_24h: boolean
  remind_1h: boolean
}

export interface ZeptomailStatus {
  configured: boolean
  from_email?: string
  /** Admin, or a role granted "Custom Email Addresses" — may type recipient addresses in a bulk email. */
  can_send_custom_emails?: boolean
}

export interface EmailTemplateOption {
  id: string
  label: string
}

export interface EmailLogEntry {
  id: string
  lead_id: string | null
  to_email: string
  template_label: string
  status: 'sending' | 'sent' | 'failed'
  error: string | null
  created_at: string
}

export async function fetchZeptomailStatus(): Promise<ZeptomailStatus> {
  return apiRequest('/zeptomail/status', { headers: authHeaders() })
}

export async function fetchEmailTemplates(): Promise<EmailTemplateOption[]> {
  return apiRequest('/zeptomail/mappings', { headers: authHeaders() })
}

export interface EmailSendFormField {
  name: string
  value: string
  sample: string | null
}

export async function fetchEmailSendForm(mappingId: string, leadId: string): Promise<{ fields_available: boolean; fields: EmailSendFormField[] }> {
  return apiRequest(`/zeptomail/mappings/${mappingId}/send-form?lead_id=${leadId}`, { headers: authHeaders() })
}

export async function sendLeadEmail(input: {
  leadId: string
  mappingId: string
  idempotencyKey: string
  mergeValues?: Record<string, string>
}): Promise<EmailLogEntry> {
  return apiRequest('/zeptomail/send', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      lead_id: input.leadId,
      mapping_id: input.mappingId,
      idempotency_key: input.idempotencyKey,
      ...(input.mergeValues && { merge_values: input.mergeValues }),
    }),
  })
}

export async function fetchEmailLogs(leadId: string): Promise<{ items: EmailLogEntry[]; total: number }> {
  return apiRequest(`/zeptomail/logs?lead_id=${leadId}&per_page=50`, { headers: authHeaders() })
}

// ---- Bulk email ----

export interface EmailBatch {
  id: string
  template_label: string
  status: 'queued' | 'sending' | 'completed'
  total_count: number
  sent_count: number
  failed_count: number
  pending_count: number
  skipped_count: number
  created_by_user_id: string
  created_by_name: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface EmailBatchSkipped {
  lead_id: string | null
  email: string | null
  reason: string
}

export interface EmailBatchRecipient {
  id: string
  lead_id: string | null
  to_email: string
  to_name: string | null
  status: 'sending' | 'sent' | 'failed'
  error: string | null
}

export interface EmailBatchDetail extends EmailBatch {
  skipped: EmailBatchSkipped[]
  recipients: EmailBatchRecipient[]
}

export async function sendBulkEmail(input: {
  mappingId: string
  batchKey: string
  leadIds: string[]
  emails: string[]
  mergeValues?: Record<string, string>
}): Promise<EmailBatch & { skipped: EmailBatchSkipped[] }> {
  return apiRequest('/zeptomail/send-bulk', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      mapping_id: input.mappingId,
      batch_key: input.batchKey,
      lead_ids: input.leadIds,
      emails: input.emails,
      ...(input.mergeValues && { merge_values: input.mergeValues }),
    }),
  })
}

export async function fetchEmailBatches(): Promise<{ items: EmailBatch[]; total: number }> {
  return apiRequest('/zeptomail/batches?per_page=30', { headers: authHeaders() })
}

export async function fetchEmailBatch(id: string): Promise<EmailBatchDetail> {
  return apiRequest(`/zeptomail/batches/${id}`, { headers: authHeaders() })
}

export async function retryFailedEmails(id: string): Promise<EmailBatch> {
  return apiRequest(`/zeptomail/batches/${id}/retry-failed`, { method: 'POST', headers: authHeaders() })
}


// ---- Push notifications (FCM device token) ----
// Registers this device for the signed-in staff member; crmbackend takes the
// staff id from the session. Re-posting the same token is harmless (upsert), and
// required after every login so a shared device follows whoever is signed in.

export async function registerFcmToken(token: string): Promise<void> {
  await apiRequest<unknown>('/api/staff/fcm-token', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ token, device_type: 'android' }),
  })
}

// ---- In-app notifications (the /notifications page + header bell) ----

export interface CrmNotification {
  id: string
  title: string
  message: string
  entity_type: string
  entity_id: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export async function fetchNotificationsPage(opts: { page: number; unreadOnly?: boolean }): Promise<PageResult<CrmNotification>> {
  const params = new URLSearchParams({
    page: String(opts.page),
    per_page: String(PAGE_SIZE),
    ...(opts.unreadOnly ? { unread_only: 'true' } : {}),
  })
  const result = await apiRequestWithMeta<CrmNotification[]>(`/api/staff/notifications?${params}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const data = await apiRequest<{ unread: number }>('/api/staff/notifications/unread-count', { headers: authHeaders() })
  return data.unread
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest<unknown>(`/api/staff/notifications/${id}/read`, { method: 'POST', headers: authHeaders() })
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<unknown>('/api/staff/notifications/read-all', { method: 'POST', headers: authHeaders() })
}

// Removes this device from the signed-in staff member on logout, so it stops
// receiving their pushes. Must run while the session token is still set.
export async function unregisterFcmToken(token: string, signal?: AbortSignal): Promise<void> {
  await apiRequest<unknown>('/api/staff/fcm-token', {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ token }),
    signal,
  })
}

// ---- Subscriptions ----

export type SubscriptionStatus = 'active' | 'expired' | 'renewed' | 'cancelled' | 'lost'
export type SubscriptionLostReason = 'price_too_high' | 'switched_competitor' | 'no_longer_needed' | 'no_response' | 'other'
/** List filter: a status, or 'expiring' = active and ending within 7 days. */
export type SubscriptionStatusFilter = SubscriptionStatus | 'expiring'

export interface CrmSubscription {
  id: string
  contact_id: string
  /** The customer's name. */
  name: string | null
  contact_phone: string | null
  /** YYYY-MM-DD calendar dates. */
  start_date: string
  end_date: string
  salesperson_id: string
  salesperson_name: string | null
  product_id: string | null
  product_name: string | null
  deal_id: string | null
  status: SubscriptionStatus
  /** What this term costs; null when not recorded. */
  amount: number | null
  /** Money received for this term (payments minus refunds). */
  paid_amount: number
  /** What is still owed; null when no amount is set. */
  balance: number | null
  notes: string | null
  /** Set only when status is 'lost'. */
  lost_reason: SubscriptionLostReason | null
  lost_at: string | null
  /** Whole days until end_date (0 = ends today); null unless the term is active. */
  days_left: number | null
  renewed_from_id: string | null
}

export async function fetchSubscriptionsPage(opts: {
  page: number
  search?: string
  status?: SubscriptionStatusFilter
  contactId?: string
  /** Only subscriptions that still owe money (the Pending view). */
  hasBalance?: boolean
  perPage?: number
}): Promise<PageResult<CrmSubscription>> {
  const businessId = getActiveBusinessId()
  const params = new URLSearchParams({
    business_id: businessId,
    page: String(opts.page),
    per_page: String(opts.perPage ?? PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.contactId ? { contact_id: opts.contactId } : {}),
    ...(opts.hasBalance ? { has_balance: '1' } : {}),
  })
  const result = await apiRequestWithMeta<CrmSubscription[]>(`/crm/subscriptions/list?${params}`, {
    headers: authHeaders(),
  })
  return toPageResult(result.data, result.meta)
}

export interface SubscriptionPaymentInput {
  amount: number
  mop: string
  notes?: string
}

export async function renewSubscription(
  id: string,
  input: { endDate: string; startDate?: string; amount?: number; notes?: string; payment?: SubscriptionPaymentInput },
): Promise<CrmSubscription> {
  return apiRequest<CrmSubscription>(`/crm/subscriptions/renew/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      end_date: input.endDate,
      ...(input.startDate ? { start_date: input.startDate } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.payment ? { payment: input.payment } : {}),
    }),
  })
}

/**
 * Money received for a term after the fact. It is credited to the salesperson
 * and dated today, so it counts toward the month it actually arrived.
 * `clientRequestId` makes a retried submit record one payment, not two.
 */
export async function recordSubscriptionPayment(
  id: string,
  input: SubscriptionPaymentInput & { clientRequestId: string },
): Promise<CrmSubscription> {
  return apiRequest<CrmSubscription>(`/crm/subscriptions/payment/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      amount: input.amount,
      mop: input.mop,
      client_request_id: input.clientRequestId,
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  })
}

/** The customer declined to renew: recorded with a reason, without cancelling. */
export async function markSubscriptionLost(
  id: string,
  input: { reason: SubscriptionLostReason; note?: string },
): Promise<CrmSubscription> {
  return apiRequest<CrmSubscription>(`/crm/subscriptions/lost/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ reason: input.reason, ...(input.note ? { note: input.note } : {}) }),
  })
}

export interface SellSubscriptionInput {
  contactId: string
  productId: string
  /** What the customer is charged for the term. */
  soldAmount: number
  startDate: string
  endDate: string
  /** Admin only: sell under another salesperson (who then gets the credit and the renewal reminders). */
  salespersonId?: string
  notes?: string
  payment: {
    /** Money received now — the only part that counts toward the target. */
    amount: number
    mop: string
    paymentDate?: string
    notes?: string
    /** One per form session — a retried submit returns the same subscription instead of selling twice. */
    clientRequestId: string
  }
}

/** Creates the subscription and the payment for it in one step. */
export async function sellSubscription(input: SellSubscriptionInput): Promise<CrmSubscription> {
  return apiRequest<CrmSubscription>('/crm/subscriptions/sell', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      business_id: getActiveBusinessId(),
      contact_id: input.contactId,
      product_id: input.productId,
      sold_amount: input.soldAmount,
      start_date: input.startDate,
      end_date: input.endDate,
      ...(input.salespersonId ? { salesperson_id: input.salespersonId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      payment: {
        amount: input.payment.amount,
        mop: input.payment.mop,
        client_request_id: input.payment.clientRequestId,
        ...(input.payment.paymentDate ? { payment_date: input.payment.paymentDate } : {}),
        ...(input.payment.notes ? { notes: input.payment.notes } : {}),
      },
    }),
  })
}

// ---------- Team booking links ----------

/** A meeting a lead booked through a team link that nobody has taken yet. Contact details stay hidden until it is taken. */
export interface CrmUnclaimedBooking {
  id: string
  event_title: string
  invitee_name: string
  start_utc: string
  end_utc: string
  duration_minutes: number
  location_type: 'link' | 'phone' | 'in_person'
  notes: string | null
  created_at: string
}

export function fetchUnclaimedBookings() {
  return apiRequest<CrmUnclaimedBooking[]>('/scheduling/bookings/unclaimed', { headers: authHeaders() })
}

/** The first executive to take it gets the meeting and the lead; a later one gets a 409. */
export function takeBooking(id: string) {
  return apiRequest<{ id: string }>(`/scheduling/bookings/${encodeURIComponent(id)}/take`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
}

// ---- My performance (GET /crm/performance/activity) ----
// What the signed-in staff member did in a date range. For anyone who isn't an
// admin or manager the backend returns only their own row.

export interface CrmStaffActivity {
  staff_id: string
  name: string
  tasks: { created: number; completed: number }
  meetings: { scheduled: number; rescheduled: number; held: number; due: number }
  followups: { created: number; done: number; due: number }
  calls: { total: number; connected: number; talk_seconds: number }
  leads: number
  deals: number
  payments: { count: number; amount: number }
  notes: number
  emails: number
  total_actions: number
}

export interface CrmActivityReport {
  from: string
  to: string
  staff: CrmStaffActivity[]
  totals: Omit<CrmStaffActivity, 'staff_id' | 'name'>
}

export async function fetchMyActivity(range: { from: string; to: string }): Promise<CrmActivityReport> {
  return apiRequest<CrmActivityReport>(`/crm/performance/activity?from=${range.from}&to=${range.to}`, { headers: authHeaders() })
}

// ---- My performance scorecard (GET /crm/performance, the caller's own row) ----

export interface CrmMyPerformance {
  staff_id: string
  name: string
  leads: { total: number; new_this_month: number; /** Current leads per pipeline stage, plus "No status". */ pipeline: Record<string, number> }
  calls: { total: number; connected: number; talk_seconds: number }
  meetings: { attended: number; upcoming: number; missed: number; cancelled: number }
  /** `overdue` is how many are late right now, whatever the period. */
  followups: { done: number; pending: number; overdue: number }
  tasks: { completed: number; open: number }
  deals: { count: number; booked_amount: number; pending_amount: number }
  /** Money received in the period, net of refunds — what the target counts. */
  collected: number
  collected_from_earlier_months: number
  target: { target_amount: number; base_salary: number; incentive_slab: { from: number; to: number; rate: number }[]; carried_forward: boolean } | null
}

export interface CrmMyPerformanceReport {
  /** The fixed pipeline stages in order. */
  stages: string[]
  mine: CrmMyPerformance | null
}

/** A whole month, or an inclusive YYYY-MM-DD range. */
export type PerformancePeriod = { month: number; year: number } | { from: string; to: string }

const periodQuery = (p: PerformancePeriod) => ('from' in p ? `from=${p.from}&to=${p.to}` : `month=${p.month}&year=${p.year}`)

export async function fetchMyPerformance(period: PerformancePeriod, staffId: string): Promise<CrmMyPerformanceReport> {
  const data = await apiRequest<{ stages: string[]; staff: CrmMyPerformance[] }>(`/crm/performance?${periodQuery(period)}`, { headers: authHeaders() })
  // Non-admins get only their own row; the id match is just a guard.
  const mine = data.staff.find((s) => s.staff_id === staffId) ?? (data.staff.length === 1 ? data.staff[0] : null)
  return { stages: data.stages, mine }
}

export type InteractionKind = 'call' | 'meeting' | 'followup'

export interface CrmInteraction {
  kind: InteractionKind
  id: string
  at: string
  contact_name: string
  /** The contact page is keyed by lead; null when the call didn't match a lead. */
  lead_id: string | null
  /** call: connected | not_connected | not_reviewed; meeting: completed | scheduled | missed | cancelled; follow-up: done | pending | overdue */
  status: string
  detail: string | null
  note: string | null
}

/** My calls, meetings and follow-ups in a period, newest first. */
export async function fetchMyInteractions(
  staffId: string,
  period: PerformancePeriod,
): Promise<{ counts: { calls: number; meetings: number; followups: number }; items: CrmInteraction[] }> {
  return apiRequest(`/crm/performance/${staffId}/interactions?${periodQuery(period)}`, { headers: authHeaders() })
}

// ---- My sales for a month: deals closed and money received ----

export interface CrmMySales {
  deals: { id: string; deal_name: string | null; contact_name: string; deal_amount: number; paid_amount: number; pending_amount: number; status: string; created_at: string }[]
  payments: {
    id: string
    contact_name: string
    deal_name: string | null
    /** Negative for a refund. */
    amount: number
    kind: string
    mop: string | null
    payment_date: string | null
    from_earlier_month: boolean
  }[]
}

export async function fetchMySales(staffId: string, month: number, year: number): Promise<CrmMySales> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId(), staff_id: staffId, month: String(month), year: String(year) })
  return apiRequest<CrmMySales>(`/crm/staff-targets/sales?${params}`, { headers: authHeaders() })
}

// ---- Open WhatsApp chats of my leads ----

export interface CrmOpenChat {
  conversation_id: string
  lead_id: string
  lead_ref: string
  lead_name: string
  phone: string
  last_message: string
  last_message_at: string
  last_from: 'customer' | 'us'
}

export interface CrmOpenChats {
  total: number
  waiting_on_us: number
  truncated: boolean
  chats: CrmOpenChat[]
}

export async function fetchMyOpenChats(): Promise<CrmOpenChats> {
  return apiRequest<CrmOpenChats>('/crm/performance/whatsapp-chats', { headers: authHeaders() })
}

// ---- Lead notes (the chat info panel) ----

export interface CrmLeadNote {
  id: string
  content: string
  created_at: string
}

export async function fetchLeadNotes(leadId: string): Promise<CrmLeadNote[]> {
  return apiRequest<CrmLeadNote[]>(`/crm/notes/lead-list?lead_id=${encodeURIComponent(leadId)}`, { headers: authHeaders() })
}

export async function createLeadNote(leadId: string, content: string): Promise<CrmLeadNote> {
  return apiRequest<CrmLeadNote>('/crm/notes/add', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lead_id: leadId, content }),
  })
}

/** The lead behind a chat: the leads list matched on the contact (the chat only knows the contact). */
export async function fetchLeadForContact(contactId: string, phone: string): Promise<CrmLead | null> {
  const digits = phone.replace(/\D/g, '')
  const result = await fetchLeadsPage({ staffId: '', page: 1, perPage: 20, search: digits.slice(-10) || undefined })
  return result.items.find((l) => l.contact_id === contactId) ?? null
}

// ---- Task page: one task, its types, subtasks, discussion, history and photos ----

export async function fetchTask(id: string): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/${encodeURIComponent(id)}`, { headers: authHeaders() })
}

/** An admin-managed task type (a "project"). A private one is limited to its members. */
export interface TaskTypeOption {
  id: string
  name: string
  is_active: boolean
  /** Staff assigned to this project. Non-empty = private to them (and admins); empty = everyone. */
  member_ids: string[]
}

export async function fetchTaskTypes(): Promise<TaskTypeOption[]> {
  return apiRequest<TaskTypeOption[]>(`/crm/tasks/types?business_id=${encodeURIComponent(getActiveBusinessId())}`, { headers: authHeaders() })
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  body: string
  image_urls: string[]
  created_at: string
}

/** The conversation on a task, oldest first. */
export async function fetchTaskComments(id: string): Promise<TaskComment[]> {
  return apiRequest<TaskComment[]>(`/crm/tasks/${encodeURIComponent(id)}/comments`, { headers: authHeaders() })
}

/** A message on a task: text, images (already uploaded links), or both. */
export async function addTaskComment(id: string, input: { body: string; imageUrls: string[] }): Promise<TaskComment> {
  return apiRequest<TaskComment>(`/crm/tasks/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ body: input.body, image_urls: input.imageUrls }),
  })
}

/** One line of a task's history: who did what and when. */
export interface TaskLogEntry {
  id: string
  kind: 'created' | 'status' | 'assignee' | 'edited' | 'comment' | 'work_notes' | 'work_images' | 'subtask' | 'closed' | string
  summary: string
  actor_id: string | null
  actor_name: string
  created_at: string
}

/** The task's history, newest first. */
export async function fetchTaskLogs(id: string): Promise<TaskLogEntry[]> {
  return apiRequest<TaskLogEntry[]>(`/crm/tasks/${encodeURIComponent(id)}/logs`, { headers: authHeaders() })
}

/** The images the assignee attached while working; replaces the whole list. */
export async function saveTaskWorkImages(id: string, imageUrls: string[]): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/work-images/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ image_urls: imageUrls }),
  })
}

// Checklist changes: each one returns the whole task.
export async function addTaskSubtask(id: string, title: string): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/${encodeURIComponent(id)}/subtasks`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ title }) })
}

export async function updateTaskSubtask(id: string, subtaskId: string, patch: { title?: string; done?: boolean }): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/${encodeURIComponent(id)}/subtasks/${encodeURIComponent(subtaskId)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  })
}

export async function deleteTaskSubtask(id: string, subtaskId: string): Promise<CrmTask> {
  return apiRequest<CrmTask>(`/crm/tasks/${encodeURIComponent(id)}/subtasks/${encodeURIComponent(subtaskId)}`, { method: 'DELETE', headers: authHeaders() })
}

// ---- Lead Board: every lead the caller can see, at once (the board needs the whole set to fill its columns) ----

export async function fetchAllLeads(): Promise<CrmLead[]> {
  return apiRequest<CrmLead[]>(`/crm/cust-res/get-list?business_id=${encodeURIComponent(getActiveBusinessId())}`, { headers: authHeaders() })
}

// ---- Raise priority ----

/** "Raise priority": a manager (or the creator) flagged an open item to its owner, until it is done. */
export interface CrmRaised {
  /** Who raised it. */
  by: string
  note: string | null
  at: string
  /** How many times it has been raised. */
  count: number
}

export type RaiseEntityType = 'task' | 'followup' | 'meeting'

/** An open item someone raised to the signed-in user (Home's "Raised for you" strip). */
export interface CrmRaisedItem {
  id: string
  entity_type: RaiseEntityType
  entity_id: string
  title: string
  due_at: string | null
  contact_name: string | null
  lead_id: string | null
  raised_by_name: string
  note: string | null
  raised_at: string
}

export async function raisePriority(input: { entityType: RaiseEntityType; entityId: string; note?: string }): Promise<{ raised_by_name: string }> {
  return apiRequest<{ raised_by_name: string }>('/crm/priority-raises', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ entity_type: input.entityType, entity_id: input.entityId, ...(input.note?.trim() ? { note: input.note.trim() } : {}) }),
  })
}

export async function fetchRaisedForMe(): Promise<CrmRaisedItem[]> {
  return apiRequest<CrmRaisedItem[]>('/crm/priority-raises/mine', { headers: authHeaders() })
}

/** The signed-in executive's own "On leave" switch. While on, no new leads are given to them;
 *  leads they already have stay with them. */
export async function setMyLeaveStatus(onLeave: boolean): Promise<{ on_leave: boolean }> {
  return apiRequest<{ on_leave: boolean }>('/crm/users/me/availability', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ on_leave: onLeave }),
  })
}
