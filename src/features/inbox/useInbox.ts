import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as inboxApi from '@/api/inboxApi'
import { sendQuickReply } from '@/api/quickRepliesApi'
import { staffMe } from '@/lib/staffAuthClient'
import { useAuthStore } from '@/store/useAuthStore'

// The inbox polls instead of holding a socket open: crmbackend stores inbound
// messages from Meta's webhook, and these intervals pick them up.
const CONVERSATIONS_POLL_MS = 8000
const MESSAGES_POLL_MS = 5000

export function useConversations(search?: string) {
  return useQuery({
    queryKey: ['conversations', search ?? ''],
    queryFn: () => inboxApi.fetchConversations(search),
    refetchInterval: CONVERSATIONS_POLL_MS,
  })
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => inboxApi.fetchMessages(conversationId as string),
    enabled: !!conversationId,
    refetchInterval: MESSAGES_POLL_MS,
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, text }: { conversationId: string; text: string }) => inboxApi.sendMessage(conversationId, text),
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useSendTemplateMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, templateId }: { conversationId: string; templateId: string }) =>
      inboxApi.sendTemplateMessage(conversationId, templateId),
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => inboxApi.markConversationRead(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

export function useStartConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) => inboxApi.startConversation(contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

export function useSendableTemplates(enabled: boolean) {
  return useQuery({ queryKey: ['inbox-templates'], queryFn: inboxApi.fetchSendableTemplates, enabled, staleTime: 60 * 1000 })
}

// 'none' = the message has no stored file (e.g. received before inbound media was saved),
// 'failed' = it could not be loaded; both show "not available" instead of an endless "Loading…".
export type MessageMediaState = 'none' | 'loading' | 'ready' | 'failed'

// Fetches a message's attachment through the authenticated proxy and hands back
// an object URL, revoked when it changes or the bubble unmounts.
export function useMessageMediaUrl(message: { id: string; mediaUrl?: string | null }): { url: string | null; state: MessageMediaState } {
  const [url, setUrl] = useState<string | null>(null)
  // The id of the message whose file failed to load (so a different message starts clean).
  const [failedId, setFailedId] = useState<string | null>(null)

  useEffect(() => {
    if (!message.mediaUrl) return
    let objectUrl: string | null = null
    let cancelled = false
    inboxApi
      .fetchMessageMedia(message.id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => {
        console.error(`[inbox] could not load attachment for message ${message.id}:`, err)
        if (!cancelled) setFailedId(message.id)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [message.id, message.mediaUrl])

  if (!message.mediaUrl) return { url: null, state: 'none' }
  if (failedId === message.id) return { url: null, state: 'failed' }
  return url ? { url, state: 'ready' } : { url: null, state: 'loading' }
}

// What the Company WhatsApp button needs to know: is a number connected, and
// what is the company's logo (saved by crmbackend when an admin signs in).
export function useWhatsappCompanyAccess() {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId)
  const { data: connection, isLoading } = useQuery({
    queryKey: ['inbox-connection', activeBusinessId],
    queryFn: inboxApi.fetchConnectionStatus,
    enabled: !!activeBusinessId,
    staleTime: 60 * 1000,
  })
  const { data: logoUrl } = useQuery({
    queryKey: ['company-branding', activeBusinessId],
    queryFn: async () => (await staffMe()).brandFaviconUrl ?? null,
    enabled: !!activeBusinessId,
    staleTime: 5 * 60 * 1000,
  })
  return {
    // The one switch for "bought CRM + WhatsApp"; the boss plan has no field for
    // it yet, so every business is entitled and only a connected number gates it.
    entitled: true,
    connected: connection?.connected ?? false,
    isLoading,
    logoUrl: logoUrl ?? null,
  }
}

export function useSendQuickReply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, quickReplyId }: { conversationId: string; quickReplyId: string }) => sendQuickReply(conversationId, quickReplyId),
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

// Files, locations, contact cards and reactions all refresh the chat the same way once sent.
function useChatMutation<V extends { conversationId: string }>(fn: (v: V) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useSendMediaMessage() {
  return useChatMutation(({ conversationId, file, caption }: { conversationId: string; file: File; caption?: string }) =>
    inboxApi.sendMediaMessage(conversationId, file, caption),
  )
}

export function useSendLocationMessage() {
  return useChatMutation(({ conversationId, input }: { conversationId: string; input: inboxApi.ShareLocationInput }) =>
    inboxApi.sendLocationMessage(conversationId, input),
  )
}

export function useSendContactMessage() {
  return useChatMutation(({ conversationId, input }: { conversationId: string; input: inboxApi.ShareContactInput }) =>
    inboxApi.sendContactMessage(conversationId, input),
  )
}

export function useSendMessageReaction() {
  return useChatMutation(({ messageId, emoji }: { conversationId: string; messageId: string; emoji: string }) =>
    inboxApi.sendMessageReaction(messageId, emoji),
  )
}
