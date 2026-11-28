import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/reportsApi'
import { fetchTicketsPage } from '@/api/ticketsApi'

export function useTeamPerformance(month: number, year: number) {
  return useQuery({ queryKey: ['team-report', 'performance', month, year], queryFn: () => api.fetchTeamPerformance(month, year) })
}

export function useTeamChats(enabled: boolean) {
  return useQuery({ queryKey: ['team-report', 'chats'], queryFn: api.fetchTeamChats, enabled, refetchInterval: 60_000 })
}

export function useDashboardSummary(range: { from?: string; to?: string }) {
  return useQuery({ queryKey: ['team-report', 'summary', range.from ?? null, range.to ?? null], queryFn: () => api.fetchDashboardSummary(range) })
}

export function useOpenTickets() {
  return useQuery({ queryKey: ['team-report', 'open-tickets'], queryFn: () => fetchTicketsPage({ page: 1, status: 'active' }) })
}

export function usePublicTickets() {
  return useQuery({ queryKey: ['team-report', 'public-tickets'], queryFn: api.fetchPublicTickets })
}

export function useSubscriberGrowth(range: '7d' | '30d' | '90d') {
  return useQuery({ queryKey: ['team-report', 'growth', range], queryFn: () => api.fetchSubscriberGrowth(range) })
}

export function useSaveTarget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.saveStaffTarget,
    onSuccess: () => {
      // A target shows in the team report, the staff member's pages and the Payments card.
      for (const key of ['team-report', 'my-target', 'my-performance', 'staff-targets']) void queryClient.invalidateQueries({ queryKey: [key] })
    },
  })
}
