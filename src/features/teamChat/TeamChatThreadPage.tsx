import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Hash, ListChecks, Paperclip, Send, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { PageLoader } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { avatarColor, cn } from '@/lib/utils'
import { formatClock } from '@/features/inbox/inboxFormat'
import { fetchChatAttachment, type ChatAttachment, type ChatMessage } from '@/api/chatApi'
import { taskTypeLabel } from '@/features/tasks/taskUi'
import type { TaskType } from '@/api/crmApi'
import { useChatChannels, useChatMe, useChatMessages, useMarkChatRead, useSendChatMessage } from './useTeamChat'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// The attachment endpoint needs the session header, so files are fetched as Blobs.
function ImageThumb({ attachment }: { attachment: ChatAttachment }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    fetchChatAttachment(attachment.id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.id])
  if (!url) return <div className="h-28 w-44 animate-pulse rounded-lg bg-[var(--surface-hover)]" />
  return <img src={url} alt={attachment.file_name} className="max-h-60 max-w-full rounded-lg object-cover" />
}

function FileChip({ attachment }: { attachment: ChatAttachment }) {
  const { show } = useToast()
  async function open() {
    try {
      const blob = await fetchChatAttachment(attachment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.file_name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      show({ title: err instanceof Error ? err.message : 'Could not open the file', tone: 'error' })
    }
  }
  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
    >
      <FileText size={14} className="shrink-0 text-[var(--text-muted)]" />
      <span className="truncate">{attachment.file_name}</span>
      <span className="shrink-0 text-[var(--text-muted)]">· {formatSize(attachment.size)}</span>
    </button>
  )
}

function MessageItem({ message, mine, showName }: { message: ChatMessage; mine: boolean; showName: boolean }) {
  const tasks = message.refs.filter((r) => r.kind === 'task')
  const tags = message.refs.filter((r) => r.kind !== 'task')
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3 py-2 text-[14px] text-[var(--text-h)]',
          mine ? 'rounded-tr-sm bg-[var(--accent-bg)]' : 'rounded-tl-sm border border-[var(--border)] bg-[var(--surface)]',
        )}
      >
        {!mine && showName && (
          <p className="mb-0.5 text-[12px] font-semibold" style={{ color: avatarColor(message.author_name) }}>
            {message.author_name}
          </p>
        )}
        {message.attachments.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-2">
            {message.attachments.map((a) =>
              a.mime_type.startsWith('image/') ? <ImageThumb key={a.id} attachment={a} /> : <FileChip key={a.id} attachment={a} />,
            )}
          </div>
        )}
        {message.body && <p className="whitespace-pre-wrap break-words leading-snug">{message.body}</p>}
        {tasks.map((t) => (
          <div key={t.id} className="mt-1 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] p-2.5">
            <div className="flex items-start gap-2">
              <ListChecks size={15} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{t.label}</p>
                {t.task && (
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                    {taskTypeLabel(t.task.task_type as TaskType)} · Assigned to {t.task.assignee_name} · {t.task.status.replace('_', ' ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={`${t.kind}-${t.id}`}
                className="inline-flex max-w-full items-center rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--text-muted)]"
              >
                {t.kind === 'staff' ? '@' : ''}
                {t.label}
              </span>
            ))}
          </div>
        )}
        <p className="mt-0.5 text-right text-[10.5px] leading-none text-[var(--text-muted)]">{formatClock(message.created_at)}</p>
      </div>
    </div>
  )
}

export function TeamChatThreadPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const { show } = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const { data: me } = useChatMe()
  const { data: channels, isLoading: loadingChannels } = useChatChannels()
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useChatMessages(channelId)
  const send = useSendChatMessage()
  const markRead = useMarkChatRead()

  const channel = channels?.find((c) => c.id === channelId)
  // Pages are newest-first; the thread reads oldest-first.
  const messages = (data?.pages.flatMap((p) => p.data) ?? []).slice().reverse()
  const newest = messages[messages.length - 1]
  const unread = channel?.unread_count ?? 0
  const canPost = channel?.is_member !== false && !channel?.is_archived

  // Clear the unread badge when opened, and again whenever more arrive while it's open.
  useEffect(() => {
    if (channelId && newest && unread > 0) markRead.mutate({ channelId, messageId: newest.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, newest?.id, unread])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [newest?.id, channelId])

  function submit() {
    const body = text.trim()
    if (!channelId || (!body && files.length === 0) || send.isPending) return
    send.mutate(
      { channelId, body, files },
      {
        onSuccess: () => {
          setText('')
          setFiles([])
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to send message', tone: 'error' }),
      },
    )
  }

  if (loadingChannels) return <PageLoader />

  if (!channel) {
    return (
      <div className="mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[14px] font-medium text-[var(--text-h)]">This chat isn't available</p>
        <p className="text-[13px] text-[var(--text-muted)]">It may be archived, or you aren't a member.</p>
        <button type="button" onClick={() => navigate('/team-chat')} className="text-[13px] font-semibold text-[var(--accent)] hover:underline">
          Back to Team Chat
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col bg-[var(--bg)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => navigate('/team-chat')}
          aria-label="Back to Team Chat"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        {channel.is_direct ? (
          <Avatar name={channel.name} size={36} />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <Hash size={17} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[var(--text-h)]">{channel.name}</p>
          {!channel.is_direct && <p className="truncate text-[12px] text-[var(--text-muted)]">{channel.member_count} members</p>}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {hasNextPage && (
          <button
            type="button"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            className="mx-auto block rounded-full border border-[var(--border)] px-3 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {isLoading ? (
          <PageLoader />
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => <MessageItem key={m.id} message={m} mine={m.author_id === me?.id} showName={!channel.is_direct} />)
        )}
      </div>

      {canPost ? (
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[12px]">
                  <span className="truncate">{f.name}</span>
                  <button type="button" aria-label="Remove file" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 p-3">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                setFiles((cur) => [...cur, ...Array.from(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={send.isPending}
              aria-label="Attach a file"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              rows={1}
              className="max-h-32 min-h-10 flex-1 rounded-2xl py-2"
            />
            <button
              type="button"
              onClick={submit}
              disabled={(!text.trim() && files.length === 0) || send.isPending}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--ink)] disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        <p className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-3 text-center text-[12.5px] text-[var(--text-muted)]">
          {channel.is_archived ? 'This channel is archived.' : "You're not a member of this channel."}
        </p>
      )}
    </div>
  )
}
