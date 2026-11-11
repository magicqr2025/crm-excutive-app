import { ApiError, apiRequest, apiRequestBlob, apiRequestForm, apiRequestWithMeta } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'

// Team chat served by crmbackend's /crm/chat (same endpoints the admin app uses).

export interface ChatMe {
  id: string
  is_admin: boolean
}

export interface ChatLastMessage {
  id: string
  author_id: string
  author_name: string
  body: string
  attachment_count: number
  attachment_mime: string | null
  attachment_name: string | null
  has_task: boolean
  created_at: string
}

export interface ChatChannel {
  id: string
  name: string
  description: string | null
  is_archived: boolean
  /** A direct message with one colleague: `name` is that person, `peer_id` their staff id. */
  is_direct: boolean
  peer_id: string | null
  member_count: number
  unread_count: number
  last_message_at: string | null
  last_message: ChatLastMessage | null
  /** false for an admin looking at a channel they are not in (can read, can't post) */
  is_member: boolean
}

export interface ChatAttachment {
  id: string
  file_name: string
  mime_type: string
  size: number
}

export interface ChatRef {
  kind: 'task' | 'ticket' | 'contact' | 'staff'
  id: string
  label: string
  lead_id?: string
  task?: {
    status: string
    task_type: string
    priority: string
    deadline: string | null
    assign_to_staff_id: string
    assignee_name: string
  }
}

export interface ChatMessage {
  id: string
  channel_id: string
  author_id: string
  author_name: string
  body: string
  client_message_id: string | null
  created_at: string
  attachments: ChatAttachment[]
  refs: ChatRef[]
}

export interface ChatPerson {
  staff_id: string
  name: string
}

const auth = (): HeadersInit => crmSessionAuthHeaders()
const ch = (id: string) => `/crm/chat/channels/${encodeURIComponent(id)}`

export const fetchChatMe = () => apiRequest<ChatMe>('/crm/chat/me', { headers: auth() })

export const fetchChannels = () => apiRequest<ChatChannel[]>('/crm/chat/channels', { headers: auth() })

export const fetchPeople = () => apiRequest<ChatPerson[]>('/crm/chat/people', { headers: auth() })

/** Opens (creating on first use) the direct message with one colleague. */
export const openDirect = (staffId: string) =>
  apiRequest<ChatChannel>('/crm/chat/direct', { method: 'POST', headers: auth(), body: JSON.stringify({ staff_id: staffId }) })

export const fetchMessages = (id: string, before?: string) =>
  apiRequestWithMeta<ChatMessage[], { has_more: boolean }>(
    `${ch(id)}/messages?${new URLSearchParams({ limit: '40', ...(before ? { before } : {}) })}`,
    { headers: auth() },
  )

export interface ChatTagInput {
  kind: 'staff'
  id: string
}

export interface ChatLookupItem {
  kind: 'staff'
  id: string
  label: string
}

/** Teammates in this channel whose name matches, for @mentions. */
export const lookupTeammates = (id: string, q: string) =>
  apiRequest<ChatLookupItem[]>(`${ch(id)}/lookup?${new URLSearchParams({ kind: 'staff', q })}`, { headers: auth() })

export const sendMessage = (id: string, input: { body: string; clientMessageId: string; files: File[]; refs?: ChatTagInput[] }) => {
  const form = new FormData()
  form.set('body', input.body)
  form.set('client_message_id', input.clientMessageId)
  form.set('refs', JSON.stringify(input.refs ?? []))
  for (const file of input.files) form.append('files', file)
  return apiRequestForm<ChatMessage>(`${ch(id)}/messages`, form, auth())
}

export const markChannelRead = (id: string, messageId: string) =>
  apiRequest<{ channel_id: string; unread_count: number }>(`${ch(id)}/read`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ message_id: messageId }),
  })

/** The file as a Blob — the endpoint needs the session header, so a plain link cannot be used. */
export const fetchChatAttachment = (id: string) => apiRequestBlob(`/crm/chat/attachments/${encodeURIComponent(id)}`, { headers: auth() })

export { ApiError }
