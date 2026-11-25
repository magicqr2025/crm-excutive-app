import type { DealStatus } from '@/api/crmApi'

// Shared names and colours for a lead's page.

export type LeadFormKind = 'followup' | 'meeting' | 'deal' | 'payment'

export type LeadTab = 'overview' | 'timeline' | 'calls' | 'followup' | 'meeting' | 'deal' | 'payment'

export const LEAD_TABS: LeadTab[] = ['overview', 'timeline', 'calls', 'followup', 'meeting', 'deal', 'payment']

// Each kind of record keeps one colour across the quick-add chip, its stat tile and its card.
export const KIND_COLOR: Record<'call' | LeadFormKind | 'note', string> = {
  call: '#1e86b0',
  followup: '#d97706',
  meeting: '#7c63e0',
  deal: '#0d9488',
  payment: '#1fa971',
  note: '#8a8371',
}

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  created: 'In progress',
  accepted: 'Won',
  canceled: 'Lost',
}
