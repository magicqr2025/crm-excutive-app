import { apiRequest, apiRequestBlob } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { useAuthStore } from '@/store/useAuthStore'

// WhatsApp chat through the business's connected number. crmbackend only lets
// an executive reach conversations of leads assigned to them (admin sees all),
// so every call here is already scoped to "my" leads.

function authHeaders(): HeadersInit {
  return crmSessionAuthHeaders()
}

function getActiveBusinessId(): string {
  const id = useAuthStore.getState().activeBusinessId
  if (!id) throw new Error('No active business')
  return id
}

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed'

export interface Conversation {
  id: string
  contactId: string | null
  contactName: string
  contactPhone: string
  status: 'open' | 'resolved'
  unreadCount: number
  lastMessageAt: string
  sessionExpiresAt: string | null
  lastMessage: { body: string | null; direction: 'in' | 'out'; status: MessageStatus } | null
}

export interface ConversationMessage {
  id: string
  conversationId: string
  direction: 'in' | 'out'
  kind: 'text' | 'template' | 'interactive' | 'image' | 'video' | 'audio' | 'document'
  body: string
  timestamp: string
  status: MessageStatus
  mediaUrl?: string | null
  mediaFilename?: string | null
}

export interface SendableTemplate {
  id: string
  name: string
  body: string
}

export interface ConnectionStatus {
  connected: boolean
  displayPhoneNumber: string | null
  verifiedName: string | null
}

export async function fetchConnectionStatus(): Promise<ConnectionStatus> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId() })
  return apiRequest<ConnectionStatus>(`/inbox/connection?${params}`, { headers: authHeaders() })
}

export async function fetchConversations(search?: string): Promise<Conversation[]> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId() })
  if (search) params.set('search', search)
  return apiRequest<Conversation[]>(`/inbox/conversations?${params}`, { headers: authHeaders() })
}

export async function fetchMessages(conversationId: string): Promise<ConversationMessage[]> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId() })
  return apiRequest<ConversationMessage[]>(`/inbox/conversations/${conversationId}/messages?${params}`, { headers: authHeaders() })
}

export async function sendMessage(conversationId: string, text: string): Promise<ConversationMessage> {
  return apiRequest<ConversationMessage>(`/inbox/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ businessId: getActiveBusinessId(), text }),
  })
}

export async function sendTemplateMessage(conversationId: string, templateId: string): Promise<ConversationMessage> {
  return apiRequest<ConversationMessage>(`/inbox/conversations/${conversationId}/template-messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ businessId: getActiveBusinessId(), templateId }),
  })
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiRequest(`/inbox/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ businessId: getActiveBusinessId() }),
  })
}

// Finds or creates the chat for a lead's contact (works for a lead that has
// never messaged in), so the Company WhatsApp button always has somewhere to land.
export async function startConversation(contactId: string): Promise<Conversation> {
  return apiRequest<Conversation>('/inbox/conversations/start', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ businessId: getActiveBusinessId(), contactId }),
  })
}

export async function fetchSendableTemplates(): Promise<SendableTemplate[]> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId() })
  return apiRequest<SendableTemplate[]>(`/inbox/templates?${params}`, { headers: authHeaders() })
}

// Attachments come through our authenticated proxy (Meta's own media URLs
// expire), so they're fetched as a Blob and shown from an object URL.
export async function fetchMessageMedia(messageId: string): Promise<Blob> {
  const params = new URLSearchParams({ business_id: getActiveBusinessId() })
  return apiRequestBlob(`/inbox/messages/${messageId}/media?${params}`, { headers: authHeaders() })
}
