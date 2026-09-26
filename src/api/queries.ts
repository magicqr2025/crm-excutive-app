import { usePagedList } from '@/lib/usePagedList'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMyLeadCampaigns,
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
  fetchMyActiveFollowupsPage,
  fetchFollowupById,
  fetchMyFollowupsPage,
  markFollowupDone,
  type FollowupTab,
  fetchContactActiveFollowups,
  fetchDealsPage,
  fetchMeetingsPage,
  fetchPaymentsPage,
  fetchLeadsPage,
  fetchLeadById,
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
  type UpdateDealInput,
  type CreateMeetingInput,
  type CreatePaymentInput,
  type UpdatePaymentInput,
  type UpdateLeadInput,
  fetchStaff,
  completeMeeting,
  cancelMeeting,
  rescheduleMeeting,
  transferMeeting,
  updateMeetingDetails,
  fetchTasksPage,
  createTask,
  updateTask,
  setTaskStatus,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskStatus,
  type TaskStatusFilter,
} from '@/api/crmApi'

export function useMyLeadCampaigns() {
  return useQuery({ queryKey: ['my-lead-campaigns'], queryFn: fetchMyLeadCampaigns })
}

export function useCampaignLeadsPage({ campaignId, staffId, scope, search }: { campaignId: string; staffId: string; scope: CampaignLeadScope; search: string }) {
  return usePagedList({
    queryKey: ['campaign-leads', campaignId, staffId, scope, { search }],
    fetchPage: (page) => fetchLeadsForCampaignPage({ campaignId, staffId, scope, page, search }),
    enabled: Boolean(campaignId && staffId),
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

export function useDealsPage(search: string) {
  return usePagedList({ queryKey: ['deals', 'paged', { search }], fetchPage: (page) => fetchDealsPage({ page, search }) })
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

export function useMeetingsPage(search: string) {
  return usePagedList({ queryKey: ['meetings', 'paged', { search }], fetchPage: (page) => fetchMeetingsPage({ page, search }) })
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

export function usePaymentsPage(search: string) {
  return usePagedList({ queryKey: ['payments', 'paged', { search }], fetchPage: (page) => fetchPaymentsPage({ page, search }) })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
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

export function useTasksPage(filters: { search: string; status?: TaskStatusFilter; assigneeId?: string }) {
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

export function useSetTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<TaskStatus, 'created'> }) => setTaskStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
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
