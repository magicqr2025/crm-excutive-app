import type { Ticket, TicketPriority, TicketStatus, TicketType } from '@/api/ticketsApi'
import { formatDateTime as fmtDateTime } from '@/lib/dateFormat'

export const SELECT_CLASS = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

export const TICKET_TYPE_OPTIONS: { value: TicketType; label: string; hint: string }[] = [
  { value: 'issue', label: 'Issue', hint: 'Something is not working the way it should' },
  { value: 'error', label: 'Error', hint: 'I see an error message or a crash' },
  { value: 'feature_request', label: 'Feature request', hint: 'I need something that does not exist yet' },
  { value: 'suggestion', label: 'Suggestion', hint: 'An idea to make something better' },
]

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  issue: 'Issue',
  error: 'Error',
  feature_request: 'Feature request',
  suggestion: 'Suggestion',
}

export const TICKET_TYPE_TONE: Record<TicketType, 'error' | 'ai' | 'success'> = {
  issue: 'error',
  error: 'error',
  feature_request: 'ai',
  suggestion: 'success',
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const TICKET_STATUS_TONE: Record<TicketStatus, 'accent' | 'warning' | 'neutral' | 'success'> = {
  open: 'accent',
  in_progress: 'warning',
  on_hold: 'neutral',
  resolved: 'success',
  closed: 'neutral',
}

export const TICKET_STATUSES = Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]

export const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }

export const TICKET_PRIORITY_TONE: Record<TicketPriority, 'neutral' | 'accent' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'accent',
  high: 'warning',
  urgent: 'error',
}

/** The number people see and quote (TKT-0001). It counts up inside each business; `id` is only for links. */
export const ticketNumber = (number: number): string => `TKT-${String(number).padStart(4, '0')}`

export const isActiveTicket = (ticket: Pick<Ticket, 'status'>): boolean => ticket.status === 'open' || ticket.status === 'in_progress' || ticket.status === 'on_hold'

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : fmtDateTime(d)
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface TicketPermissions {
  /** move through any status */
  manage: boolean
  /** the raiser's limited moves: close, or reopen a finished ticket */
  close: boolean
  reopen: boolean
  /** set priority and assignee */
  triage: boolean
  /** write a staff-only note */
  internalNote: boolean
}

// Mirrors crmbackend's tickets.access.js. Only decides which controls appear; the server is the real gate.
export function getTicketPermissions(ticket: Pick<Ticket, 'status' | 'raised_by' | 'assign_to_staff_id'>, userId: string, isAdmin: boolean): TicketPermissions {
  const isRaiser = userId !== '' && ticket.raised_by === userId
  const isAssignee = userId !== '' && ticket.assign_to_staff_id === userId
  const manage = isAdmin || isAssignee
  return {
    manage,
    close: !manage && isRaiser && ticket.status !== 'closed',
    reopen: !manage && isRaiser && (ticket.status === 'resolved' || ticket.status === 'closed'),
    triage: isAdmin,
    internalNote: manage,
  }
}
