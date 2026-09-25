import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMyLeadCampaigns,
  fetchLeadsForCampaign,
  fetchNextQueueLead,
  fetchMyLeads,
  updateLead,
  claimLead,
  quickCreateLead,
  type QuickCreateLeadInput,
  fetchLeadActivity,
  fetchLeadStageTypes,
  fetchLeadStatuses,
  createCallLog,
  fetchMyCallLogs,
  fetchMyActiveFollowups,
  fetchCallLogsForLead,
  searchContacts,
  fetchDeals,
  createDeal,
  updateDeal,
  fetchMeetings,
  createMeeting,
  updateMeeting,
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
  type UpdateMeetingInput,
} from '@/api/crmApi'

export function useMyLeadCampaigns() {
  return useQuery({ queryKey: ['my-lead-campaigns'], queryFn: fetchMyLeadCampaigns })
}

export function useLeadsForCampaign(campaignId: string, staffId: string, scope: CampaignLeadScope = 'mine') {
  return useQuery({
    queryKey: ['campaign-leads', campaignId, staffId, scope],
    queryFn: () => fetchLeadsForCampaign(campaignId, staffId, scope),
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

export function useMyLeads(staffId: string) {
  return useQuery({ queryKey: ['my-leads', staffId], queryFn: () => fetchMyLeads(staffId), enabled: Boolean(staffId) })
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
    },
  })
}

export function useMyCallLogs(staffId: string) {
  return useQuery({ queryKey: ['my-call-logs', staffId], queryFn: () => fetchMyCallLogs(staffId), enabled: Boolean(staffId) })
}

export function useMyActiveFollowups(staffId: string) {
  return useQuery({ queryKey: ['my-followups', staffId], queryFn: () => fetchMyActiveFollowups(staffId), enabled: Boolean(staffId) })
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

export function useDeals() {
  return useQuery({ queryKey: ['deals'], queryFn: fetchDeals })
}

export function useCreateDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDealInput) => createDeal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useUpdateDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateDealInput }) => updateDeal(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useMeetings() {
  return useQuery({ queryKey: ['meetings'], queryFn: fetchMeetings })
}

export function useCreateMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => createMeeting(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMeetingInput }) => updateMeeting(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

export function usePayments() {
  return useQuery({ queryKey: ['payments'], queryFn: fetchPayments })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  })
}

export function useUpdatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePaymentInput }) => updatePayment(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  })
}
