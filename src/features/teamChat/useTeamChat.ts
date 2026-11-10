import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as chatApi from '@/api/chatApi'

// Like the WhatsApp inbox, team chat polls instead of holding a stream open:
// a long-lived connection is unreliable inside the Android WebView.
const CHANNELS_POLL_MS = 8000
const MESSAGES_POLL_MS = 5000

const KEYS = {
  all: ['team-chat'] as const,
  me: ['team-chat', 'me'] as const,
  channels: ['team-chat', 'channels'] as const,
  people: ['team-chat', 'people'] as const,
  messages: (id: string) => ['team-chat', 'messages', id] as const,
}

export function useChatMe() {
  return useQuery({ queryKey: KEYS.me, queryFn: chatApi.fetchChatMe, staleTime: Infinity })
}

export function useChatChannels() {
  return useQuery({ queryKey: KEYS.channels, queryFn: chatApi.fetchChannels, refetchInterval: CHANNELS_POLL_MS })
}

export function useChatUnreadTotal(): number {
  const { data } = useChatChannels()
  return (data ?? []).reduce((sum, c) => sum + (c.is_archived ? 0 : c.unread_count), 0)
}

export function useChatPeople(enabled: boolean) {
  return useQuery({ queryKey: KEYS.people, queryFn: chatApi.fetchPeople, enabled, staleTime: 60_000 })
}

export function useOpenDirect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: chatApi.openDirect,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.channels }),
  })
}

export function useChatMessages(channelId: string | undefined) {
  return useInfiniteQuery({
    queryKey: KEYS.messages(channelId ?? ''),
    enabled: Boolean(channelId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await chatApi.fetchMessages(channelId as string, pageParam)
      return { data: res.data, has_more: res.has_more }
    },
    // Pages are newest-first; the next (older) page starts before the oldest id held.
    getNextPageParam: (last) => (last.has_more ? last.data[last.data.length - 1]?.id : undefined),
    refetchInterval: MESSAGES_POLL_MS,
  })
}

export function useSendChatMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ channelId, body, files }: { channelId: string; body: string; files: File[] }) =>
      chatApi.sendMessage(channelId, { body, files, clientMessageId: crypto.randomUUID() }),
    onSuccess: (_m, { channelId }) => {
      qc.invalidateQueries({ queryKey: KEYS.messages(channelId) })
      qc.invalidateQueries({ queryKey: KEYS.channels })
    },
  })
}

export function useMarkChatRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ channelId, messageId }: { channelId: string; messageId: string }) => chatApi.markChannelRead(channelId, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.channels }),
  })
}
