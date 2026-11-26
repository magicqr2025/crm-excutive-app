import { Fragment, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { Composer } from './Composer'
import { ConversationInfoSheet } from './ConversationInfoSheet'
import { formatDayLabel, isSessionOpen } from './inboxFormat'
import { MessageBubble } from './MessageBubble'
import {
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendContactMessage,
  useSendLocationMessage,
  useSendMediaMessage,
  useSendMessage,
  useSendMessageReaction,
  useSendQuickReply,
  useSendTemplateMessage,
} from './useInbox'

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { show } = useToast()
  // Opened from a contact's Inbox button: Back returns to that page (history back keeps its tab, search and scroll).
  const backTo = (location.state as { backTo?: string } | null)?.backTo
  const goBack = () => (backTo ? navigate(-1) : navigate('/inbox'))
  const backLabel = backTo ? 'Back' : 'Back to Inbox'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [infoOpen, setInfoOpen] = useState(false)

  const { data: conversations, isLoading: isLoadingConversations } = useConversations()
  const { data: messages = [], isLoading: isLoadingMessages } = useMessages(conversationId)
  const sendMessage = useSendMessage()
  const sendTemplate = useSendTemplateMessage()
  const sendQuickReply = useSendQuickReply()
  const sendMedia = useSendMediaMessage()
  const sendLocation = useSendLocationMessage()
  const sendContact = useSendContactMessage()
  const sendReaction = useSendMessageReaction()
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
        <button type="button" onClick={goBack} className="text-[13px] font-semibold text-[var(--accent)] hover:underline">
          {backLabel}
        </button>
      </div>
    )
  }

  const sessionOpen = isSessionOpen(conversation.sessionExpiresAt)

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col bg-[var(--bg)]">
      {/* Header: back, who, whether the 24-hour window is open, chat info. */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] bg-[var(--surface)]/95 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={goBack}
          aria-label={backLabel}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-h)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <ArrowLeft size={19} />
        </button>
        <span className="relative shrink-0">
          <Avatar name={conversation.contactName} size={40} />
          <span
            aria-hidden
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[var(--surface)] ${sessionOpen ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-h)]">{conversation.contactName}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px]">
            <span className={`shrink-0 font-semibold ${sessionOpen ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {sessionOpen ? 'Session open' : 'Session closed'}
            </span>
            <span aria-hidden className="text-[var(--text-muted)]">·</span>
            <span className="truncate font-mono-num text-[var(--text-muted)]">{conversation.contactPhone}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="Chat info"
          title="Chat info"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)] hover:bg-[var(--accent)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <Info size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="chat-wall min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {isLoadingMessages ? (
          <PageLoader />
        ) : messages.length === 0 ? (
          <p className="mx-auto my-8 w-fit rounded-full bg-[var(--surface)] px-4 py-2 text-center text-[12.5px] text-[var(--text-muted)] ring-1 ring-[var(--border)]">No messages yet. Send a template to start the chat.</p>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.id}>
            {/* A day divider wherever the date changes. */}
            {(i === 0 || new Date(messages[i - 1].timestamp).toDateString() !== new Date(m.timestamp).toDateString()) && (
              <div className="sticky top-0 z-[1] flex justify-center py-2">
                <span className="rounded-full bg-[var(--surface)]/90 px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-[var(--border)] backdrop-blur">
                  {formatDayLabel(m.timestamp)}
                </span>
              </div>
            )}
            <MessageBubble
              message={m}
              // Reacting to a customer's message is only allowed while the 24-hour window is open (WhatsApp's rule).
              onReact={
                m.direction === 'in' && sessionOpen && !conversation.blocked
                  ? (emoji) =>
                      sendReaction.mutate(
                        { conversationId: conversation.id, messageId: m.id, emoji },
                        { onError: (err) => reportFailure('Could not send the reaction', err) },
                      )
                  : undefined
              }
            />
            </Fragment>
          ))
        )}
      </div>

      <ConversationInfoSheet conversation={conversation} open={infoOpen} onClose={() => setInfoOpen(false)} />

      <Composer
        sessionOpen={sessionOpen}
        isSending={sendMessage.isPending || sendTemplate.isPending || sendQuickReply.isPending || sendMedia.isPending}
        onSendMedia={(file, caption) =>
          sendMedia.mutate({ conversationId: conversation.id, file, caption }, { onError: (err) => reportFailure('Failed to send the file', err) })
        }
        onSendLocation={(input) =>
          sendLocation.mutate({ conversationId: conversation.id, input }, { onError: (err) => reportFailure('Failed to send location', err) })
        }
        onSendContact={(input) =>
          sendContact.mutate({ conversationId: conversation.id, input }, { onError: (err) => reportFailure('Failed to send contact card', err) })
        }
        onSend={(text) =>
          sendMessage.mutate({ conversationId: conversation.id, text }, { onError: (err) => reportFailure('Failed to send message', err) })
        }
        onSendQuickReply={(quickReplyId) =>
          sendQuickReply.mutate({ conversationId: conversation.id, quickReplyId }, { onError: (err) => reportFailure('Failed to send quick reply', err) })
        }
        onSendTemplate={(templateId) =>
          sendTemplate.mutate({ conversationId: conversation.id, templateId }, { onError: (err) => reportFailure('Failed to send template', err) })
        }
      />
    </div>
  )
}
