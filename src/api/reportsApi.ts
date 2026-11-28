// Team reports for admins. Same endpoints as orm-whatsapp's Performance, Target and Dashboard pages.
import type { CrmIncentiveSlab, CrmMyPerformance, CrmOpenChat } from '@/api/crmApi'
import type { TicketStatus } from '@/api/ticketsApi'
import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { useAuthStore } from '@/store/useAuthStore'

export interface TeamPerformance {
  /** Pipeline stages in order. */
  stages: string[]
  /** Active staff only. */
  staff: CrmMyPerformance[]
}

export interface TeamChat extends CrmOpenChat {
  staff_id: string
  staff_name: string
}

export interface TeamChats {
  total: number
  waiting_on_us: number
  truncated: boolean
  chats: TeamChat[]
}

interface Row {
  id: string
  assignee_name?: string
}

export interface LeadRow extends Row {
  contact_name: string
  contact_phone: string | null
  created_at: string
  lead_id: string
}

export interface DashboardSummary {
  cards: {
    recent_leads: { total: number; recent: LeadRow[] }
    untouched_leads: { total: number; recent: LeadRow[] }
    followups: { pending: number; recent: (Row & { contact_name: string; scheduled_date: string; lead_id: string | null })[] }
    meetings: { upcoming: number; recent: (Row & { contact_name: string; scheduled_at: string; lead_id: string | null })[] }
    deals: { open: number; recent: (Row & { deal_name: string; contact_name: string; amount: number; status: string; lead_id: string | null })[] }
    tasks: { open: number; recent: (Row & { title: string; deadline: string | null })[] }
    payments: {
      month_total: number
      recent: (Row & { contact_name: string; amount: number; kind: 'payment' | 'refund'; mop: string | null; payment_date: string; lead_id: string | null })[]
    }
  }
}

export interface PublicTicketsSummary {
  active: number
  latest: { id: string; ticket_number: string; subject: string; status: TicketStatus; customer_name: string | null; assigned: boolean; created_at: string }[]
}

export interface GrowthPoint {
  date: string
  total: number
  gained: number
  dropped: number
}

export interface TargetInput {
  staff_id: string
  target_month: number
  target_year: number
  target_amount: number
  base_salary: number
  incentive_slab: CrmIncentiveSlab[]
}

const get = <T>(path: string) => apiRequest<T>(path, { headers: crmSessionAuthHeaders() })

export const fetchTeamPerformance = (month: number, year: number) => get<TeamPerformance>(`/crm/performance?month=${month}&year=${year}`)

export const fetchTeamChats = () => get<TeamChats>('/crm/performance/whatsapp-chats')

export const fetchDashboardSummary = (range: { from?: string; to?: string }) =>
  get<DashboardSummary>(`/crm/dashboard/summary${range.from && range.to ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : ''}`)

export const fetchPublicTickets = () => get<PublicTicketsSummary>('/crm/tickets/public-summary')

export const fetchSubscriberGrowth = (range: '7d' | '30d' | '90d') => get<GrowthPoint[]>(`/crm/dashboard/subscriber-growth?range=${range}`)

/** Creates or replaces that person's target for that month (admin only on the server). */
export function saveStaffTarget(input: TargetInput) {
  return apiRequest<unknown>('/crm/staff-targets/add', {
    method: 'POST',
    headers: crmSessionAuthHeaders(),
    body: JSON.stringify({ business_id: useAuthStore.getState().activeBusinessId, ...input }),
  })
}
