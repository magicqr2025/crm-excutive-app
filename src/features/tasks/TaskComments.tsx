import { useState } from 'react'
import { ImagePlus, Loader2, Send, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useAddTaskComment, useTaskComments } from '@/api/queries'
import type { CrmTask, StaffMember } from '@/api/crmApi'
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
      <header className="border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-[var(--text-h)]">Discussion</h3>
        <p className="text-[12px] text-[var(--text-muted)]">Ask a question or reply — everyone on this task is notified</p>
      </header>
      <div className="space-y-4 p-4">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">No messages yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => {
              const name = staffLabel(staff, c.author_id)
              return (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar name={name} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text-h)]">{c.author_id === userId ? 'You' : name}</span>
                      <span>{formatDeadline(c.created_at)}</span>
                    </div>
                    {c.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--text)]">{c.body}</p>}
                    {c.image_urls.length > 0 && (
                      <div className="mt-2">
                        <ImageThumbs urls={c.image_urls} />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {canWrite && (
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000} placeholder="Write a question or reply…" />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <span key={url} className="relative">
                    <img src={url} alt={`Attachment ${i + 1}`} className="h-16 w-16 rounded-md border border-[var(--border)] object-cover" />
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
            <div className="flex items-center justify-between gap-2">
              {uploader.input((urls) => setImages((prev) => [...prev, ...urls]))}
              <Button size="sm" variant="outline" disabled={uploader.uploading || images.length >= MAX_COMMENT_IMAGES} onClick={uploader.open}>
                {uploader.uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {uploader.uploading ? 'Uploading…' : 'Attach image'}
              </Button>
              <Button size="sm" disabled={!canSend} onClick={send}>
                {add.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
