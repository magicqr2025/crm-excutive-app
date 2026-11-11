import { apiRequest, apiRequestBlob, apiRequestForm, apiRequestWithMeta } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { PAGE_SIZE, toPageResult, type PageResult } from '@/lib/paging'
import { useAuthStore } from '@/store/useAuthStore'

// Support-desk tickets served by crmbackend's /crm/tickets (the same system the admin app uses).

export type TicketType = 'issue' | 'error' | 'feature_request' | 'suggestion'
export type TicketStatus = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
/** List filter: a status, or 'active' = open + in progress + on hold. */
export type TicketStatusFilter = TicketStatus | 'active'

export interface TicketMaster {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export interface TicketAttachment {
  id: string
  comment_id: string | null
  file_name: string
  mime_type: string
  size: number
  created_at: string
}

/** A file kept in cloud storage (an image a customer uploaded on the public ticket page). */
export interface TicketCloudFile {
  id: string
  file_name: string
  mime_type: string
  size: number
  url: string
  created_at: string
}

export interface TicketComment {
  id: string
  author_id: string | null
  author_name: string | null
  body: string
  is_internal: boolean
  is_system: boolean
  created_at: string
  attachments: TicketAttachment[]
  cloud_files: TicketCloudFile[]
}

export interface Ticket {
  id: string
  /** the number shown as TKT-0001, counting up inside the business */
  number: number
  ticket_number: string
  subject: string
  description: string
  ticket_type: TicketType
  priority: TicketPriority
  status: TicketStatus
  category_id: string | null
  category_name: string | null
  product_id: string | null
  product_name: string | null
  contact_id: string | null
  contact_name: string | null
  raised_by: string | null
  raised_by_name: string | null
  /** true when another software created it through the public API (no app user raised it) */
  raised_via_api: boolean
  external_id: string | null
  requester_type: 'customer' | 'business' | 'public_page' | null
  requester_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  assign_to_staff_id: string | null
  assigned_to_name: string | null
  resolved_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface TicketDetail extends Ticket {
  attachments: TicketAttachment[]
  cloud_files: TicketCloudFile[]
  comments: TicketComment[]
}

export interface TicketSummary {
  total: number
  active: number
  by_status: Record<TicketStatus, number>
  active_by_priority: Record<TicketPriority, number>
  active_by_type: Record<TicketType, number>
  new_tickets: number
  old_tickets: number
  unassigned: number
  assigned_to_me: number
  new_window_hours: number
  old_after_days: number
}

export interface TicketListFilters {
  search?: string
  status?: TicketStatusFilter
  priority?: TicketPriority
  ticketType?: TicketType
  categoryId?: string
  /** a staff id, or 'unassigned' */
  assigneeId?: string
  age?: 'new' | 'old'
}

export interface CreateTicketInput {
  subject: string
  description: string
  ticketType: TicketType
  categoryId: string
  productId?: string
  contactId?: string
  files: File[]
}

// Keep in step with crmbackend's tickets.routes.js upload limits.
export const TICKET_MAX_FILES = 5
export const TICKET_MAX_FILE_BYTES = 5 * 1024 * 1024
export const TICKET_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx'

const authHeaders = (): HeadersInit => crmSessionAuthHeaders()

function businessId(): string {
  const id = useAuthStore.getState().activeBusinessId
  if (!id) throw new Error('No active business')
  return id
}

const base = (id: string) => `/crm/tickets/${encodeURIComponent(id)}`

export const fetchTicketSummary = () => apiRequest<TicketSummary>(`/crm/tickets/summary?business_id=${encodeURIComponent(businessId())}`, { headers: authHeaders() })

export async function fetchTicketsPage(opts: { page: number } & TicketListFilters): Promise<PageResult<Ticket>> {
  const query = new URLSearchParams({
    business_id: businessId(),
    page: String(opts.page),
    per_page: String(PAGE_SIZE),
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.priority ? { priority: opts.priority } : {}),
    ...(opts.ticketType ? { ticket_type: opts.ticketType } : {}),
    ...(opts.categoryId ? { category_id: opts.categoryId } : {}),
    ...(opts.assigneeId ? { assign_to_staff_id: opts.assigneeId } : {}),
    ...(opts.age ? { age: opts.age } : {}),
  })
  const result = await apiRequestWithMeta<Ticket[]>(`/crm/tickets/list?${query}`, { headers: authHeaders() })
  return toPageResult(result.data, result.meta)
}

export const fetchTicket = (id: string) => apiRequest<TicketDetail>(base(id), { headers: authHeaders() })

export function createTicket(input: CreateTicketInput): Promise<TicketDetail> {
  const form = new FormData()
  form.set('business_id', businessId())
  form.set('subject', input.subject)
  form.set('description', input.description)
  form.set('ticket_type', input.ticketType)
  form.set('category_id', input.categoryId)
  if (input.productId) form.set('product_id', input.productId)
  if (input.contactId) form.set('contact_id', input.contactId)
  for (const file of input.files) form.append('files', file)
  return apiRequestForm<TicketDetail>('/crm/tickets/add', form, authHeaders())
}

export const setTicketStatus = (id: string, status: TicketStatus) =>
  apiRequest<TicketDetail>(`${base(id)}/status`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ status }) })

export const triageTicket = (id: string, patch: { priority?: TicketPriority; assignToStaffId?: string | null }) =>
  apiRequest<TicketDetail>(`${base(id)}/triage`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.assignToStaffId !== undefined ? { assign_to_staff_id: patch.assignToStaffId } : {}),
    }),
  })

export function addTicketComment(id: string, input: { body: string; isInternal: boolean; files: File[] }): Promise<TicketDetail> {
  const form = new FormData()
  form.set('body', input.body)
  if (input.isInternal) form.set('is_internal', 'true')
  for (const file of input.files) form.append('files', file)
  return apiRequestForm<TicketDetail>(`${base(id)}/comments`, form, authHeaders())
}

/** The file as a Blob — the endpoint needs the session header, so a plain link cannot be used. */
export const fetchTicketAttachment = (id: string) => apiRequestBlob(`/crm/tickets/attachments/${encodeURIComponent(id)}`, { headers: authHeaders() })

// Masters (categories / products) are admin-managed; anyone signed in can read them for the create form.
export const fetchTicketMasters = (kind: 'categories' | 'products') =>
  apiRequest<TicketMaster[]>(`/crm/tickets/${kind}?business_id=${encodeURIComponent(businessId())}`, { headers: authHeaders() })

/** The slug of the business's public ticket page (/public/<slug>/ticket). Any role that can view tickets may read it. */
export const fetchTicketPublicLink = () => apiRequest<{ slug: string; agency_domain: string | null }>('/crm/tickets/public-link', { headers: authHeaders() })
