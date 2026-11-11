import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { useAuthStore } from '@/store/useAuthStore'
import type { ConversationMessage } from './inboxApi'

// Ready-made WhatsApp messages (text, an image or file, buttons) kept by the business and sent to a customer in one tap.

export type QuickReplyMediaType = 'image' | 'video' | 'document'
export type QuickReplyButton = { type: 'reply'; title: string } | { type: 'url'; title: string; url: string }

export interface QuickReply {
  id: string
  title: string
  body: string
  mediaType: QuickReplyMediaType | null
  mediaUrl: string | null
  mediaFilename: string | null
  buttons: QuickReplyButton[]
}

function businessId(): string {
  const id = useAuthStore.getState().activeBusinessId
  if (!id) throw new Error('No active business')
  return id
}

export const fetchQuickReplies = () =>
  apiRequest<QuickReply[]>(`/inbox/quick-replies?business_id=${encodeURIComponent(businessId())}`, { headers: crmSessionAuthHeaders() })

export const sendQuickReply = (conversationId: string, quickReplyId: string) =>
  apiRequest<ConversationMessage>(`/inbox/conversations/${encodeURIComponent(conversationId)}/quick-reply-messages`, {
    method: 'POST',
    headers: crmSessionAuthHeaders(),
    body: JSON.stringify({ businessId: businessId(), quickReplyId }),
  })

export interface QuickReplyInput {
  title: string
  body: string
  mediaType: QuickReplyMediaType | null
  mediaUrl: string | null
  mediaFilename: string | null
  buttons: QuickReplyButton[]
}

// Managing the library needs the "inbox → edit" permission; the server refuses anyone else.

export const createQuickReply = (input: QuickReplyInput) =>
  apiRequest<QuickReply>('/inbox/quick-replies', {
    method: 'POST',
    headers: crmSessionAuthHeaders(),
    body: JSON.stringify({ businessId: businessId(), ...input }),
  })

export const updateQuickReply = (id: string, input: QuickReplyInput) =>
  apiRequest<QuickReply>(`/inbox/quick-replies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: crmSessionAuthHeaders(),
    body: JSON.stringify({ businessId: businessId(), ...input }),
  })

export const deleteQuickReply = (id: string) =>
  apiRequest<null>(`/inbox/quick-replies/${encodeURIComponent(id)}?business_id=${encodeURIComponent(businessId())}`, {
    method: 'DELETE',
    headers: crmSessionAuthHeaders(),
  })
