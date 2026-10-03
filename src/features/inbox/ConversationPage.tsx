import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { Composer } from './Composer'
import { isSessionOpen } from './inboxFormat'
import { MessageBubble } from './MessageBubble'
import { useConversations, useMarkConversationRead, useMessages, useSendMessage, useSendTemplateMessage } from './useInbox'

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { show } = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: conversations, isLoading: isLoadingConversations } = useConversations()
  const { data: messages = [], isLoading: isLoadingMessages } = useMessages(conversationId)
  const sendMessage = useSendMessage()
  const sendTemplate = useSendTemplateMessage()
  const markRead = useMarkConversationRead()

  const conversation = conversations?.find((c) => c.id === conversationId)
  const unreadCount = conversation?.unreadCount ?? 0

  // Clear the unread badge when the chat is opened, and again if more arrive while it's open.
  useEffect(() => {
    if (conversationId && unreadCount > 0) {
      markRead.mutate(conversationId, {
        onError: (err) => console.error(`[inbox] could not mark conversation ${conversationId} read:`, err),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, unreadCount])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, conversationId])

  function reportFailure(title: string, err: unknown) {
    show({ title, description: err instanceof Error ? err.message : undefined, tone: 'error' })
  }

  if (isLoadingConversations) return <PageLoader />

  // Only chats of leads assigned to this executive are returned, so a missing
  // one is either gone or belongs to someone else.
  if (!conversation) {
    return (
      <div className="mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[14px] font-medium text-[var(--text-h)]">This chat isn't available</p>
        <p className="text-[13px] text-[var(--text-muted)]">It may belong to a lead assigned to someone else.</p>
        <button type="button" onClick={() => navigate('/inbox')} className="text-[13px] font-semibold text-[var(--accent)] hover:underline">
          Back to Inbox
        </button>
      </div>
    )
  }

  const sessionOpen = isSessionOpen(conversation.sessionExpiresAt)

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col bg-[var(--bg)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => navigate('/inbox')}
          aria-label="Back to Inbox"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <Avatar name={conversation.contactName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[var(--text-h)]">{conversation.contactName}</p>
          <p className="truncate text-[12px] text-[var(--text-muted)]">{conversation.contactPhone}</p>
        </div>
        <Badge tone={sessionOpen ? 'success' : 'warning'}>{sessionOpen ? 'Session open' : 'Session closed'}</Badge>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {isLoadingMessages ? (
          <PageLoader />
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No messages yet. Send a template to start the chat.</p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      <Composer
        sessionOpen={sessionOpen}
        isSending={sendMessage.isPending || sendTemplate.isPending}
        onSend={(text) =>
          sendMessage.mutate({ conversationId: conversation.id, text }, { onError: (err) => reportFailure('Failed to send message', err) })
        }
        onSendTemplate={(templateId) =>
          sendTemplate.mutate({ conversationId: conversation.id, templateId }, { onError: (err) => reportFailure('Failed to send template', err) })
        }
      />
    </div>
  )
}
