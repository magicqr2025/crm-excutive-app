import { Check, CheckCheck, Download, FileText, LayoutTemplate } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConversationMessage } from '@/api/inboxApi'
import { formatClock } from './inboxFormat'
import { useMessageMediaUrl } from './useInbox'

function StatusTick({ status }: { status: ConversationMessage['status'] }) {
  if (status === 'failed') return <span className="text-[11px] font-medium text-[var(--error)]">Failed</span>
  if (status === 'read') return <CheckCheck size={14} className="text-[var(--info)]" />
  if (status === 'delivered') return <CheckCheck size={14} className="text-[var(--text-muted)]" />
  return <Check size={14} className="text-[var(--text-muted)]" />
}

export function MessageBubble({ message }: { message: ConversationMessage }) {
  const mediaUrl = useMessageMediaUrl(message)
  const out = message.direction === 'out'

  return (
    <div className={cn('flex', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3 py-2 text-[14px] text-[var(--text-h)]',
          out ? 'rounded-tr-sm bg-[var(--accent-bg)]' : 'rounded-tl-sm border border-[var(--border)] bg-[var(--surface)]',
        )}
      >
        {message.kind === 'template' && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[var(--accent-strong)]">
            <LayoutTemplate size={12} />
            Template
          </div>
        )}

        {message.kind === 'image' &&
          (mediaUrl ? (
            <img src={mediaUrl} alt="" className="mb-1 max-h-64 max-w-full rounded-lg object-contain" />
          ) : (
            <div className="mb-1 flex h-28 w-44 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[12px] text-[var(--text-muted)]">
              Loading…
            </div>
          ))}

        {message.kind === 'video' && mediaUrl && <video src={mediaUrl} controls className="mb-1 max-h-64 max-w-full rounded-lg" />}
        {message.kind === 'audio' && mediaUrl && <audio src={mediaUrl} controls className="mb-1 max-w-full" />}

        {message.kind === 'document' && (
          <a
            href={mediaUrl ?? undefined}
            download={message.mediaFilename ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex items-center gap-2 rounded-lg bg-[var(--surface-hover)] px-2.5 py-2"
          >
            <FileText size={18} className="shrink-0 text-[var(--accent-strong)]" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{message.mediaFilename || 'Document'}</span>
            {mediaUrl && <Download size={14} className="shrink-0 text-[var(--text-muted)]" />}
          </a>
        )}

        {message.body && <p className="whitespace-pre-wrap break-words leading-snug">{message.body}</p>}

        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10.5px] text-[var(--text-muted)]">{formatClock(message.timestamp)}</span>
          {out && <StatusTick status={message.status} />}
        </div>
      </div>
    </div>
  )
}
