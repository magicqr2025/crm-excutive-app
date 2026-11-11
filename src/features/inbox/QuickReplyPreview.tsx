import { ExternalLink, FileText, Video } from 'lucide-react'
import type { QuickReply } from '@/api/quickRepliesApi'

/** How a quick reply will look in the chat: media, text, buttons. */
export function QuickReplyPreview({ body, mediaType, mediaUrl, mediaFilename, buttons }: Pick<QuickReply, 'body' | 'mediaType' | 'mediaUrl' | 'mediaFilename' | 'buttons'>) {
  return (
    <div className="w-full max-w-[420px] rounded-xl rounded-tl-none bg-[var(--bubble-out)] p-2 text-[13px] text-[var(--text-h)] shadow-sm">
      {mediaType === 'image' && mediaUrl && <img src={mediaUrl} alt="" className="mb-1.5 max-h-44 w-full rounded-lg object-cover" />}
      {mediaType === 'video' && (
        <div className="mb-1.5 flex h-28 w-full items-center justify-center rounded-lg bg-black/10 text-[var(--text-muted)]">
          <Video size={26} />
        </div>
      )}
      {mediaType === 'document' && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2">
          <FileText size={18} className="shrink-0 text-[var(--accent-strong)]" />
          <span className="min-w-0 flex-1 truncate">{mediaFilename || 'Document'}</span>
        </div>
      )}
      <p className="whitespace-pre-wrap break-words px-1 leading-snug">{body || 'Your message…'}</p>
      {buttons.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-black/10 pt-1">
          {buttons.map((b, i) => (
            <div key={i} className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium text-[var(--accent-strong)]">
              {b.type === 'url' && <ExternalLink size={13} />}
              {b.title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

