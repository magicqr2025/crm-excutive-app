import { useState } from 'react'
import { ImagePlus, Loader2, MessagesSquare, Send, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/useToast'
import { useAddTaskComment, useTaskComments } from '@/api/queries'
import type { CrmTask, StaffMember } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { ImageThumbs, useImageUploader } from './taskImages'
import { formatDeadline, staffLabel } from './taskUi'

const MAX_COMMENT_IMAGES = 5

// The conversation on a task: whoever can see the task (assignee, creator, admin) asks or answers here, with
// text and/or images. A cancelled task is read-only.
export function TaskComments({ task, staff, userId }: { task: CrmTask; staff: StaffMember[]; userId: string }) {
  const { data: comments = [], isLoading } = useTaskComments(task.id)
  const add = useAddTaskComment(task.id)
  const { show } = useToast()
  const [text, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const uploader = useImageUploader(MAX_COMMENT_IMAGES, images.length)
  const canWrite = task.status !== 'cancelled'
  const canSend = (text.trim() !== '' || images.length > 0) && !uploader.uploading && !add.isPending

  function send() {
    if (!canSend) return
    add.mutate(
      { body: text.trim(), imageUrls: images },
      {
        onSuccess: () => {
          setText('')
          setImages([])
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not send the message', tone: 'error' }),
      },
    )
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-start justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <MessagesSquare size={15} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[var(--text-h)]">Discussion</h3>
            <p className="text-[12px] leading-snug text-[var(--text-muted)]">Ask a question or reply — everyone on this task is notified</p>
          </div>
        </div>
        {comments.length > 0 && <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-[var(--text-muted)]">{comments.length}</span>}
      </header>
      <div className="space-y-4 px-4 pb-4 pt-3 sm:px-5">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="rounded-xl bg-[var(--surface-hover)] px-3.5 py-3 text-[13px] text-[var(--text-muted)]">No messages yet. Ask a question or share an update.</p>
        ) : (
          <ul className="space-y-3.5">
            {comments.map((c) => {
              const name = staffLabel(staff, c.author_id)
              const mine = c.author_id === userId
              return (
                <li key={c.id} className="flex items-end gap-2.5">
                  <Avatar name={name} size={28} />
                  <div className="min-w-0 max-w-[88%]">
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 px-1 text-[12px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text-h)]">{mine ? 'You' : name}</span>
                      <span className="tabular-nums">{formatDeadline(c.created_at)}</span>
                    </div>
                    <div className={cn('rounded-2xl rounded-bl-md px-3.5 py-2.5', mine ? 'bg-[var(--accent-bg)]' : 'bg-[var(--surface-hover)]')}>
                      {c.body && <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--text-h)]">{c.body}</p>}
                      {c.image_urls.length > 0 && (
                        <div className={c.body ? 'mt-2' : ''}>
                          <ImageThumbs urls={c.image_urls} />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {canWrite && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-colors focus-within:border-[var(--accent-border)]">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={5000}
              placeholder="Write a question or reply…"
              aria-label="Write a question or reply"
              className="block max-h-48 min-h-[56px] w-full resize-none bg-transparent px-3.5 pt-3 text-[14px] text-[var(--text-h)] outline-none [field-sizing:content] placeholder:text-[var(--text-muted)]"
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pb-1 pt-1">
                {images.map((url, i) => (
                  <span key={url} className="relative">
                    <img src={url} alt={`Attachment ${i + 1}`} className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove image ${i + 1}`}
                      onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--surface)] p-0.5 shadow ring-1 ring-[var(--border)]"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
              {uploader.input((urls) => setImages((prev) => [...prev, ...urls]))}
              <button
                type="button"
                disabled={uploader.uploading || images.length >= MAX_COMMENT_IMAGES}
                onClick={uploader.open}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)] disabled:opacity-50"
              >
                {uploader.uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                {uploader.uploading ? 'Uploading…' : 'Attach image'}
              </button>
              <button
                type="button"
                disabled={!canSend}
                onClick={send}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--ink)] transition hover:brightness-95 disabled:opacity-45"
              >
                {add.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
