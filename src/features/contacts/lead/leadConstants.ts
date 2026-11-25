import type { DealStatus } from '@/api/crmApi'

// Shared names and colours for a lead's page.

export type LeadFormKind = 'task' | 'followup' | 'meeting' | 'deal' | 'payment' | 'paylink'

export type LeadTab = 'overview' | 'timeline' | 'calls' | 'followup' | 'tasks' | 'meeting' | 'deal' | 'payment' | 'automations' | 'ai-calls'

/** Same order and names as orm-whatsapp's contact page. AI Calls is shown only to roles with AI calling. */
export const LEAD_TABS: LeadTab[] = ['overview', 'timeline', 'calls', 'followup', 'tasks', 'meeting', 'deal', 'payment', 'automations', 'ai-calls']

export const LEAD_TAB_LABEL: Record<LeadTab, string> = {
  overview: 'Overview',
  timeline: 'Activity',
  calls: 'Call Log',
  followup: 'Followup',
  tasks: 'Tasks',
  meeting: 'Meeting',
  deal: 'Deal',
  payment: 'Payment',
  automations: 'Automations',
  'ai-calls': 'AI Calls',
}

// Each kind of record keeps one colour across the quick-add chip, its stat tile and its card.
export const KIND_COLOR: Record<'call' | LeadFormKind | 'note', string> = {
  call: '#1e86b0',
  task: '#2563eb',
  paylink: '#0891b2',
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
