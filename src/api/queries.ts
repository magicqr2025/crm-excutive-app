import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMyLeadCampaigns,
  fetchLeadsForCampaign,
  fetchNextQueueLead,
  fetchLeadStageTypes,
  fetchLeadStatuses,
  createCallLog,
  fetchMyCallLogs,
  fetchMyActiveFollowups,
  fetchCallLogsForLead,
  searchContacts,
  fetchDeals,
  createDeal,
  fetchMeetings,
  createMeeting,
  fetchPayments,
  createPayment,
  type CreateCallLogInput,
  type CreateDealInput,
  type CreateMeetingInput,
  type CreatePaymentInput,
} from '@/api/crmApi'

export function useMyLeadCampaigns() {
  return useQuery({ queryKey: ['my-lead-campaigns'], queryFn: fetchMyLeadCampaigns })
}

export function useLeadsForCampaign(campaignId: string, staffId: string) {
  return useQuery({
    queryKey: ['campaign-leads', campaignId, staffId],
    queryFn: () => fetchLeadsForCampaign(campaignId, staffId),
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
