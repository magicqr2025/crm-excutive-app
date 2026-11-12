import { usePagedList } from '@/lib/usePagedList'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  saveTaskWorkNotes,
  fetchUnclaimedBookings,
  takeBooking,
  fetchMyLeadCampaigns,
  fetchZeptomailStatus,
  fetchEmailTemplates,
  fetchEmailLogs,
  fetchEmailSendForm,
  sendLeadEmail,
  sendBulkEmail,
  fetchEmailBatches,
  fetchEmailBatch,
  retryFailedEmails,
  fetchLeadsForCampaignPage,
  fetchNextQueueLead,
  updateLead,
  claimLead,
  quickCreateLead,
  type QuickCreateLeadInput,
  fetchLeadActivity,
  fetchLeadStageTypes,
  fetchLeadStatuses,
  createCallLog,
  fetchMyCallLogsPage,
  fetchNotificationsPage,
  fetchMyActivity,
  fetchMyPerformance,
  fetchMyOpenChats,
  fetchRaisedForMe,
  raisePriority,
  type RaiseEntityType,
  fetchMyInteractions,
  fetchMySales,
  fetchLeadNotes,
  createLeadNote,
  fetchLeadForContact,
  type PerformancePeriod,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  fetchMyActiveFollowupsPage,
  fetchFollowupById,
  fetchMyFollowupsPage,
  markFollowupDone,
  type FollowupTab,
  fetchContactActiveFollowups,
  fetchDealsPage,
  fetchActiveProducts,
  fetchMyTargets,
  fetchMeetingsPage,
  fetchMeetingById,
  type MeetingsPageOpts,
  fetchPaymentsPage,
  fetchMyTarget,
  fetchLeadsPage,
  fetchLeadById,
  fetchAllLeads,
  createFollowup,
  type CreateFollowupInput,
  fetchCallLogsForLead,
  searchContacts,
  fetchDeals,
  createDeal,
  updateDeal,
  fetchMeetings,
  createMeeting,
  fetchPayments,
  createPayment,
  updatePayment,
  type CampaignLeadScope,
  type CreateCallLogInput,
  type CreateDealInput,
  type DealPaymentStatus,
  type UpdateDealInput,
  type CreateMeetingInput,
  type CreatePaymentInput,
  type PaymentFilters,
  type UpdatePaymentInput,
  type UpdateLeadInput,
  fetchStaff,
  completeMeeting,
  cancelMeeting,
  rescheduleMeeting,
  transferMeeting,
  updateMeetingDetails,
  fetchTasksPage,
  fetchSubscriptionsPage,
  renewSubscription,
  markSubscriptionLost,
  sellSubscription,
  type SellSubscriptionInput,
  recordSubscriptionPayment,
  type SubscriptionPaymentInput,
  type SubscriptionLostReason,
  type SubscriptionStatusFilter,
  createTask,
  updateTask,
  setTaskStatus,
  fetchTask,
  fetchTaskTypes,
  fetchTaskComments,
  addTaskComment,
  fetchTaskLogs,
  saveTaskWorkImages,
  addTaskSubtask,
  updateTaskSubtask,
  deleteTaskSubtask,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskStatus,
  type TaskStatusFilter,
  type TaskType,
} from '@/api/crmApi'
import { useAuthStore } from '@/store/useAuthStore'
import { addTicketComment, createTicket, fetchTicket, fetchTicketPublicLink, fetchTicketMasters, fetchTicketSummary, fetchTicketsPage, setTicketStatus, triageTicket, type CreateTicketInput, type TicketListFilters, type TicketPriority, type TicketStatus } from '@/api/ticketsApi'
import { createQuickReply, deleteQuickReply, fetchQuickReplies, updateQuickReply, type QuickReplyInput } from '@/api/quickRepliesApi'
import { bookForContact, fetchEventTypes, fetchLinkDays, fetchLinkSlots, fetchSchedulingProfile, setEventTypeActive } from '@/api/schedulingApi'

export function useMyLeadCampaigns() {
  return useQuery({ queryKey: ['my-lead-campaigns'], queryFn: fetchMyLeadCampaigns })
}

export function useCampaignLeadsPage({ campaignId, staffId, scope, search, anyStaff = false }: { campaignId: string; staffId: string; scope: CampaignLeadScope; search: string; /** List the campaign's leads whoever owns them (no staff filter). */ anyStaff?: boolean }) {
  return usePagedList({
    queryKey: ['campaign-leads', campaignId, staffId, scope, { search }],
    fetchPage: (page) => fetchLeadsForCampaignPage({ campaignId, staffId, scope, page, search }),
    enabled: Boolean(campaignId && (staffId || anyStaff)),
  })
}

export function useNextQueueLead(campaignId: string, staffId: string, excludeLeadId?: string) {
  return useQuery({
    queryKey: ['next-queue-lead', campaignId, staffId, excludeLeadId ?? null],
    queryFn: () => fetchNextQueueLead(campaignId, staffId, excludeLeadId),
    enabled: Boolean(campaignId && staffId),
  })
}

// Keys all start with 'my-leads' so the existing invalidations (create, claim,
// update) refresh these too.
export function useLeadsPage({ staffId, search, unassigned }: { staffId: string; search: string; unassigned: boolean }) {
  return usePagedList({
    queryKey: ['my-leads', 'paged', staffId, { search, unassigned }],
    fetchPage: (page) => fetchLeadsPage({ staffId, page, search, unassigned }),
    enabled: Boolean(staffId),
  })
}

// Total leads matching the tab, from a one-row page's meta.total.
export function useLeadCount(staffId: string, unassigned: boolean) {
  return useQuery({
    queryKey: ['my-leads', 'count', staffId, unassigned],
    queryFn: async () => (await fetchLeadsPage({ staffId, page: 1, perPage: 1, unassigned })).total,
    enabled: Boolean(staffId),
  })
}

export function useLead(leadId: string) {
  return useQuery({ queryKey: ['my-leads', 'one', leadId], queryFn: () => fetchLeadById(leadId), enabled: Boolean(leadId), retry: false })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateLeadInput }) => updateLead(id, patch),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-leads'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity', variables.id] })
    },
  })
}

export function useClaimLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (leadId: string) => claimLead(leadId),
    onSettled: (_data, _err, leadId) => {
      queryClient.invalidateQueries({ queryKey: ['my-leads'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      queryClient.invalidateQueries({ queryKey: ['my-lead-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity', leadId] })
    },
  })
}

export function useQuickCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuickCreateLeadInput) => quickCreateLead(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leads'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      queryClient.invalidateQueries({ queryKey: ['my-lead-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['next-queue-lead'] })
    },
  })
}

export function useLeadActivity(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['lead-activity', leadId],
    queryFn: () => fetchLeadActivity(leadId as string),
    enabled: Boolean(leadId),
  })
}

export function useLeadStageTypes() {
  return useQuery({ queryKey: ['lead-stage-types'], queryFn: fetchLeadStageTypes })
}

export function useLeadStatuses() {
  return useQuery({ queryKey: ['lead-statuses'], queryFn: fetchLeadStatuses })
}

export function useCreateCallLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCallLogInput) => createCallLog(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lead-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      queryClient.invalidateQueries({ queryKey: ['next-queue-lead'] })
      queryClient.invalidateQueries({ queryKey: ['my-call-logs'] })
      queryClient.invalidateQueries({ queryKey: ['my-leads'] })
    },
  })
}

export function useMyCallLogsPage(staffId: string, search: string) {
  return usePagedList({
    queryKey: ['my-call-logs', staffId, { search }],
    fetchPage: (page) => fetchMyCallLogsPage({ staffId, page, search }),
    enabled: Boolean(staffId),
  })
}

export function useMyActiveFollowupsPage(staffId: string, search: string) {
  return usePagedList({
    queryKey: ['my-followups', 'paged', staffId, { search }],
    fetchPage: (page) => fetchMyActiveFollowupsPage({ staffId, page, search }),
    enabled: Boolean(staffId),
  })
}

export function useMyFollowupsTabPage(staffId: string, tab: FollowupTab, search: string) {
  return usePagedList({
    queryKey: ['my-followups', 'tab', staffId, tab, { search }],
    fetchPage: (page) => fetchMyFollowupsPage({ staffId, tab, page, search }),
    enabled: Boolean(staffId),
  })
}

// Just the total, for the red count on the Overdue tab.
export function useOverdueFollowupCount(staffId: string) {
  return useQuery({
    queryKey: ['my-followups', 'overdue-count', staffId],
    queryFn: async () => (await fetchMyFollowupsPage({ staffId, tab: 'overdue', page: 1, perPage: 1 })).total,
    enabled: Boolean(staffId),
  })
}

export function useMarkFollowupDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markFollowupDone(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-followups'] }),
  })
}

export function useContactActiveFollowups(contactId: string) {
  return useQuery({
    queryKey: ['my-followups', 'contact', contactId],
    queryFn: () => fetchContactActiveFollowups(contactId),
    enabled: Boolean(contactId),
  })
}

export function useFollowup(id: string) {
  return useQuery({ queryKey: ['my-followups', 'one', id], queryFn: () => fetchFollowupById(id), enabled: Boolean(id), retry: false })
}

export function useCallLogsForLead(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['call-logs-for-lead', leadId],
    queryFn: () => fetchCallLogsForLead(leadId as string),
    enabled: Boolean(leadId),
  })
}

export function useContactSearch(search: string) {
  return useQuery({
    queryKey: ['contact-search', search],
    queryFn: () => searchContacts(search),
    enabled: search.trim().length > 1,
  })
}

export function useDeals(contactId?: string) {
  return useQuery({ queryKey: contactId ? ['deals', 'contact', contactId] : ['deals'], queryFn: () => fetchDeals(contactId) })
}

export function useActiveProducts() {
  return useQuery({ queryKey: ['products', 'active'], queryFn: fetchActiveProducts })
}

export function useDealsPage(search: string, paymentStatus?: DealPaymentStatus) {
  return usePagedList({
    queryKey: ['deals', 'paged', { search, paymentStatus }],
    fetchPage: (page) => fetchDealsPage({ page, search, paymentStatus }),
  })
}

export function useMyTargets() {
  return useQuery({ queryKey: ['staff-targets', 'mine'], queryFn: fetchMyTargets })
}

export function useCreateDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDealInput) => createDeal(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
    },
  })
}

export function useUpdateDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateDealInput }) => updateDeal(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
    },
  })
}

export function useMeetings(contactId?: string) {
  return useQuery({ queryKey: contactId ? ['meetings', 'contact', contactId] : ['meetings'], queryFn: () => fetchMeetings(contactId) })
}

export function useMeetingsPage(filters: Omit<MeetingsPageOpts, 'page'>) {
  return usePagedList({ queryKey: ['meetings', 'paged', filters], fetchPage: (page) => fetchMeetingsPage({ page, ...filters }) })
}

export function useMeeting(id: string | undefined) {
  return useQuery({ queryKey: ['meetings', 'one', id], queryFn: () => fetchMeetingById(id as string), enabled: Boolean(id), retry: false })
}

export function useUnclaimedBookings() {
  return useQuery({ queryKey: ['unclaimed-bookings'], queryFn: () => fetchUnclaimedBookings(), refetchInterval: 60_000 })
}

export function useTakeBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => takeBooking(id),
    // Whether it worked or someone else got there first, the list is stale.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['unclaimed-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useCreateMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => createMeeting(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
    },
  })
}

export function usePayments(contactId?: string) {
  return useQuery({ queryKey: contactId ? ['payments', 'contact', contactId] : ['payments'], queryFn: () => fetchPayments(contactId) })
}

export function usePaymentsPage(filters: PaymentFilters) {
  return usePagedList({ queryKey: ['payments', 'paged', filters], fetchPage: (page) => fetchPaymentsPage({ page, ...filters }) })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(input),
    // A payment changes the deal's balance, its collection task, and this month's target.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['staff-targets'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
    },
  })
}

export function useUpdatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePaymentInput }) => updatePayment(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
    },
  })
}

export function useCreateFollowup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFollowupInput) => createFollowup(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-followups'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
    },
  })
}

// ---- Tasks ----

export function useStaffList() {
  return useQuery({ queryKey: ['staff-list'], queryFn: fetchStaff, staleTime: 5 * 60 * 1000 })
}

export function useTasksPage(filters: { search: string; status?: TaskStatusFilter; assigneeId?: string; taskType?: TaskType; excludeTaskType?: TaskType }) {
  return usePagedList({
    queryKey: ['tasks', 'paged', filters],
    fetchPage: (page) => fetchTasksPage({ page, ...filters }),
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) => updateTask(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useSaveTaskWorkNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, workNotes }: { id: string; workNotes: string | null }) => saveTaskWorkNotes(id, workNotes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useSetTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => setTaskStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

// ---- Subscriptions ----

export function useSubscriptionsPage(filters: { search: string; status?: SubscriptionStatusFilter }) {
  return usePagedList({
    queryKey: ['subscriptions', 'paged', filters],
    fetchPage: (page) => fetchSubscriptionsPage({ page, ...filters }),
  })
}

export function useRenewSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; endDate: string; startDate?: string; amount?: number; notes?: string; payment?: SubscriptionPaymentInput }) =>
      renewSubscription(id, input),
    // A renewal payment also changes this month's target and the payments list.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-targets'] }),
      ]),
  })
}

export function useRecordSubscriptionPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & SubscriptionPaymentInput & { clientRequestId: string }) =>
      recordSubscriptionPayment(id, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-targets'] }),
      ]),
  })
}

/** Subscriptions that still owe money — listed with unpaid deals under Pending. */
export function usePendingSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions', 'pending'],
    queryFn: async () => (await fetchSubscriptionsPage({ page: 1, perPage: 100, hasBalance: true })).items,
  })
}

/** Subscriptions for one customer (for the "For" picker on a payment). */
export function useContactSubscriptions(contactId: string) {
  return useQuery({
    queryKey: ['subscriptions', 'contact', contactId],
    queryFn: async () => (await fetchSubscriptionsPage({ page: 1, contactId })).items,
    staleTime: 30 * 1000,
  })
}

/** Sells a subscription and records its payment in one step (the Log payment form with a product). */
export function useSellSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SellSubscriptionInput) => sellSubscription(input),
    // The sale adds a payment, so this month's target and the payments list change too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-targets'] }),
        queryClient.invalidateQueries({ queryKey: ['lead-activity'] }),
      ]),
  })
}

export function useMarkSubscriptionLost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; reason: SubscriptionLostReason; note?: string }) =>
      markSubscriptionLost(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

// ---- Meeting lifecycle ----

// A meeting action can also create a task or a follow-up, so refresh those lists too.
function useMeetingMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['meetings'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['my-followups'] }),
      ]),
  })
}

export function useCompleteMeeting() {
  return useMeetingMutation(({ id, input }: { id: string; input: Parameters<typeof completeMeeting>[1] }) =>
    completeMeeting(id, input),
  )
}

export function useCancelMeeting() {
  return useMeetingMutation(({ id, input }: { id: string; input: Parameters<typeof cancelMeeting>[1] }) => cancelMeeting(id, input))
}

export function useRescheduleMeeting() {
  return useMeetingMutation(({ id, meetingTime }: { id: string; meetingTime: string }) => rescheduleMeeting(id, meetingTime))
}

export function useTransferMeeting() {
  return useMeetingMutation(({ id, input }: { id: string; input: Parameters<typeof transferMeeting>[1] }) => transferMeeting(id, input))
}

export function useUpdateMeetingDetails() {
  return useMeetingMutation(({ id, patch }: { id: string; patch: Parameters<typeof updateMeetingDetails>[1] }) =>
    updateMeetingDetails(id, patch),
  )
}

export function useMyTarget(month: number, year: number) {
  return useQuery({ queryKey: ['my-target', month, year], queryFn: () => fetchMyTarget(month, year) })
}

// ---- Email (ZeptoMail) ----

export function useZeptomailStatus() {
  return useQuery({ queryKey: ['zeptomail-status'], queryFn: fetchZeptomailStatus })
}

export function useEmailTemplates() {
  return useQuery({ queryKey: ['email-templates'], queryFn: fetchEmailTemplates })
}

export function useEmailSendForm(mappingId: string, leadId: string) {
  return useQuery({
    queryKey: ['email-send-form', mappingId, leadId],
    queryFn: () => fetchEmailSendForm(mappingId, leadId),
    enabled: Boolean(mappingId) && Boolean(leadId),
    staleTime: 0,
  })
}

export function useEmailLogs(leadId: string) {
  return useQuery({ queryKey: ['email-logs', leadId], queryFn: () => fetchEmailLogs(leadId), enabled: Boolean(leadId) })
}

// ---- Bulk email ----

export function useSendBulkEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof sendBulkEmail>[0]) => sendBulkEmail(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-batches'] }),
  })
}

export function useEmailBatches(enabled = true) {
  return useQuery({ queryKey: ['email-batches', 'list'], queryFn: () => fetchEmailBatches(), enabled })
}

// Polls every 2s while the batch is still going, then stops.
export function useEmailBatch(id: string | null) {
  return useQuery({
    queryKey: ['email-batches', 'detail', id],
    queryFn: () => fetchEmailBatch(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === 'completed' ? false : 2000),
  })
}

export function useRetryFailedEmails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => retryFailedEmails(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-batches'] }),
  })
}


export function useSendLeadEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sendLeadEmail,
    // Refresh on failure too: the backend records failed attempts, so history changes either way.
    onSettled: (_data, _err, vars) => queryClient.invalidateQueries({ queryKey: ['email-logs', vars.leadId] }),
  })
}

// ---- In-app notifications ----

const NOTIFICATIONS_KEY = ['notifications'] as const

// Polled so the header badge stays fresh; it's a tiny request.
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread'],
    queryFn: fetchUnreadNotificationCount,
    refetchInterval: 30_000,
  })
}

export function useNotificationsPage(unreadOnly: boolean) {
  return usePagedList({
    queryKey: [...NOTIFICATIONS_KEY, 'list', { unreadOnly }],
    fetchPage: (page) => fetchNotificationsPage({ page, unreadOnly }),
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

// ---- My performance ----

export function useMyActivity(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: ['my-activity', range],
    queryFn: () => fetchMyActivity(range as { from: string; to: string }),
    enabled: Boolean(range),
  })
}

export function useMyPerformance(period: PerformancePeriod, staffId: string) {
  return useQuery({
    queryKey: ['my-performance', staffId, period],
    queryFn: () => fetchMyPerformance(period, staffId),
    enabled: Boolean(staffId),
  })
}

export function useMyInteractions(period: PerformancePeriod, staffId: string) {
  return useQuery({
    queryKey: ['my-interactions', staffId, period],
    queryFn: () => fetchMyInteractions(staffId, period),
    enabled: Boolean(staffId),
  })
}

export function useMySales(staffId: string, month: number, year: number) {
  return useQuery({
    queryKey: ['my-sales', staffId, month, year],
    queryFn: () => fetchMySales(staffId, month, year),
    enabled: Boolean(staffId),
  })
}

export function useMyOpenChats() {
  return useQuery({ queryKey: ['my-open-chats'], queryFn: fetchMyOpenChats, refetchInterval: 60_000 })
}

// ---- Chat info panel (one conversation's contact) ----

export function useLeadForContact(contactId: string | null, phone: string) {
  return useQuery({
    queryKey: ['lead-for-contact', contactId],
    queryFn: () => fetchLeadForContact(contactId as string, phone),
    enabled: Boolean(contactId),
  })
}

export function useContactTasks(contactId: string | null) {
  return useQuery({
    queryKey: ['tasks', 'contact', contactId],
    queryFn: async () => (await fetchTasksPage({ page: 1, perPage: 30, contactId: contactId as string })).items,
    enabled: Boolean(contactId),
  })
}

export function useLeadNotes(leadId: string | null) {
  return useQuery({ queryKey: ['lead-notes', leadId], queryFn: () => fetchLeadNotes(leadId as string), enabled: Boolean(leadId) })
}

export function useAddLeadNote(leadId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => createLeadNote(leadId as string, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-notes', leadId] }),
  })
}

// ---- Booking links and free-time booking (staff side) ----

export function useEventTypes() {
  return useQuery({ queryKey: ['scheduling-event-types'], queryFn: fetchEventTypes })
}

export function useSchedulingProfile() {
  return useQuery({ queryKey: ['scheduling-profile'], queryFn: fetchSchedulingProfile })
}

export function useSetEventTypeActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setEventTypeActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduling-event-types'] }),
  })
}

export function useLinkDays(eventTypeId: string | null, tz: string, duration?: number) {
  return useQuery({
    queryKey: ['scheduling-link-days', eventTypeId, tz, duration],
    queryFn: () => fetchLinkDays(eventTypeId as string, tz, duration),
    enabled: Boolean(eventTypeId),
  })
}

export function useLinkSlots(eventTypeId: string | null, date: string | null, tz: string, duration?: number) {
  return useQuery({
    queryKey: ['scheduling-link-slots', eventTypeId, date, tz, duration],
    queryFn: () => fetchLinkSlots(eventTypeId as string, date as string, tz, duration),
    enabled: Boolean(eventTypeId && date),
  })
}

export function useBookForContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bookForContact,
    onSuccess: () => {
      // A booking also creates a meeting.
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      queryClient.invalidateQueries({ queryKey: ['scheduling-link-slots'] })
      queryClient.invalidateQueries({ queryKey: ['scheduling-link-days'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
    },
  })
}

// ---- Quick replies ----

export function useQuickReplies(enabled = true) {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId)
  return useQuery({ queryKey: ['quick-replies', activeBusinessId], queryFn: fetchQuickReplies, enabled: enabled && Boolean(activeBusinessId), staleTime: 60 * 1000 })
}

export function useQuickReplyMutations() {
  const queryClient = useQueryClient()
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['quick-replies', activeBusinessId] })
  return {
    create: useMutation({ mutationFn: createQuickReply, onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: QuickReplyInput }) => updateQuickReply(id, input), onSuccess: refresh }),
    remove: useMutation({ mutationFn: deleteQuickReply, onSuccess: refresh }),
  }
}

// ---- Tickets (the support desk) ----

export function useTicketSummary() {
  return useQuery({ queryKey: ['crm-tickets', 'summary'], queryFn: fetchTicketSummary })
}

export function useTicketsPage(filters: TicketListFilters) {
  return usePagedList({ queryKey: ['crm-tickets', 'paged', filters], fetchPage: (page) => fetchTicketsPage({ page, ...filters }) })
}

export function useTicket(id: string | undefined) {
  return useQuery({ queryKey: ['crm-tickets', 'detail', id], queryFn: () => fetchTicket(id as string), enabled: Boolean(id), retry: false })
}

export function useTicketMasters(kind: 'categories' | 'products') {
  return useQuery({ queryKey: ['crm-ticket-masters', kind], queryFn: () => fetchTicketMasters(kind), staleTime: 5 * 60 * 1000 })
}

// Any ticket change can move the counts and the list, so refresh the whole family.
function useTicketMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-tickets'] }) })
}

export const useCreateTicket = () => useTicketMutation((input: CreateTicketInput) => createTicket(input))
export const useSetTicketStatus = () => useTicketMutation(({ id, status }: { id: string; status: TicketStatus }) => setTicketStatus(id, status))
export const useTriageTicket = () =>
  useTicketMutation(({ id, patch }: { id: string; patch: { priority?: TicketPriority; assignToStaffId?: string | null } }) => triageTicket(id, patch))
export const useAddTicketComment = () =>
  useTicketMutation(({ id, ...input }: { id: string; body: string; isInternal: boolean; files: File[] }) => addTicketComment(id, input))

export function useTicketPublicLink(enabled = true) {
  return useQuery({ queryKey: ['crm-tickets', 'public-link'], queryFn: fetchTicketPublicLink, enabled, staleTime: 5 * 60 * 1000 })
}

// ---- Task page ----

export function useTask(id: string | undefined) {
  return useQuery({ queryKey: ['tasks', 'one', id], queryFn: () => fetchTask(id as string), enabled: Boolean(id), retry: false })
}

export function useTaskTypes() {
  return useQuery({ queryKey: ['task-types'], queryFn: fetchTaskTypes, staleTime: 5 * 60 * 1000 })
}

export function useTaskComments(id: string) {
  // Polled so a reply shows up while the task page is open.
  return useQuery({ queryKey: ['tasks', 'comments', id], queryFn: () => fetchTaskComments(id), refetchInterval: 20_000 })
}

export function useAddTaskComment(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { body: string; imageUrls: string[] }) => addTaskComment(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useTaskLogs(id: string) {
  return useQuery({ queryKey: ['tasks', 'logs', id], queryFn: () => fetchTaskLogs(id), refetchInterval: 30_000 })
}

export function useSaveTaskWorkImages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, imageUrls }: { id: string; imageUrls: string[] }) => saveTaskWorkImages(id, imageUrls),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useTaskSubtaskMutations(taskId: string) {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  return {
    add: useMutation({ mutationFn: (title: string) => addTaskSubtask(taskId, title), onSuccess }),
    update: useMutation({
      mutationFn: ({ subtaskId, ...patch }: { subtaskId: string; title?: string; done?: boolean }) => updateTaskSubtask(taskId, subtaskId, patch),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (subtaskId: string) => deleteTaskSubtask(taskId, subtaskId), onSuccess }),
  }
}

// Under 'my-leads' so every lead change that refreshes the Contacts list refreshes the board too.
export function useAllLeads() {
  return useQuery({ queryKey: ['my-leads', 'all'], queryFn: fetchAllLeads })
}

// ---- Raise priority ----

/** Everything a raise changes: the flag on tasks / follow-ups / meetings, the Home strip and the bell. */
function invalidateRaised(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['tasks', 'my-followups', 'meetings', 'priority-raises', 'notifications']) {
    queryClient.invalidateQueries({ queryKey: [key] })
  }
}

export function useRaisePriority() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { entityType: RaiseEntityType; entityId: string; note?: string }) => raisePriority(input),
    onSuccess: () => invalidateRaised(queryClient),
  })
}

/** Open items others have raised to me. */
export function useRaisedForMe() {
  return useQuery({ queryKey: ['priority-raises', 'mine'], queryFn: fetchRaisedForMe, refetchInterval: 60_000 })
}
