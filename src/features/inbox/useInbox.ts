import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as inboxApi from '@/api/inboxApi'
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

// Fetches a message's attachment through the authenticated proxy and hands back
// an object URL, revoked when it changes or the bubble unmounts.
export function useMessageMediaUrl(message: { id: string; mediaUrl?: string | null }): string | null {
  const [url, setUrl] = useState<string | null>(null)

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
      .catch((err) => console.error(`[inbox] could not load attachment for message ${message.id}:`, err))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [message.id, message.mediaUrl])

  return message.mediaUrl ? url : null
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
