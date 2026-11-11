import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ExternalLink, FileText, MessageSquareText, Send, Video } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { useQuickReplies } from '@/api/queries'
import type { QuickReply } from '@/api/quickRepliesApi'

/** How a quick reply will look in the chat: media, text, buttons. */
function Preview({ item }: { item: QuickReply }) {
  return (
    <div className="w-full max-w-[420px] rounded-xl rounded-tl-none bg-[var(--bubble-out)] p-2 text-[13px] text-[var(--text-h)] shadow-sm">
      {item.mediaType === 'image' && item.mediaUrl && <img src={item.mediaUrl} alt="" className="mb-1.5 max-h-44 w-full rounded-lg object-cover" />}
      {item.mediaType === 'video' && (
        <div className="mb-1.5 flex h-28 w-full items-center justify-center rounded-lg bg-black/10 text-[var(--text-muted)]">
          <Video size={26} />
        </div>
      )}
      {item.mediaType === 'document' && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2">
          <FileText size={18} className="shrink-0 text-[var(--accent-strong)]" />
          <span className="min-w-0 flex-1 truncate">{item.mediaFilename || 'Document'}</span>
        </div>
      )}
      <p className="whitespace-pre-wrap break-words px-1 leading-snug">{item.body}</p>
      {item.buttons.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-black/10 pt-1">
          {item.buttons.map((b, i) => (
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

interface QuickRepliesDialogProps {
  open: boolean
  onClose: () => void
  /** The chat's 24-hour window is closed: the library can still be read, but nothing can be sent. */
  canSend: boolean
  isSending: boolean
  onSend: (quickReplyId: string) => void
}

/** The business's ready-made messages: pick one, check how it will look, and send it. */
export function QuickRepliesDialog({ open, onClose, canSend, isSending, onSend }: QuickRepliesDialogProps) {
  const { data: items = [], isLoading, isError } = useQuickReplies(open)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QuickReply | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q)) : items
  }, [items, search])

  function close() {
    setSearch('')
    setSelected(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={close}>
      <Dialog.Header>
        <div className="flex min-w-0 items-center gap-2">
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Back to quick replies"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Dialog.Title className="truncate">{selected ? selected.title : 'Quick replies'}</Dialog.Title>
        </div>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>

      {selected ? (
        <>
          <Dialog.Body className="space-y-3 bg-[var(--bg)]">
            <Preview item={selected} />
            {!canSend && (
              <p className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                The 24-hour window is closed, so only a template message can be sent now.
              </p>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button
              className="w-full justify-center"
              disabled={!canSend || isSending}
              onClick={() => {
                onSend(selected.id)
                close()
              }}
            >
              <Send size={14} /> {isSending ? 'Sending…' : 'Send'}
            </Button>
          </Dialog.Footer>
        </>
      ) : (
        <Dialog.Body className="space-y-3">
          <SearchBox value={search} onSubmit={setSearch} placeholder="Search quick replies" />
          {isLoading ? (
            <PageLoader />
          ) : isError ? (
            <p className="py-6 text-center text-[13px] text-[var(--error)]">Couldn't load quick replies. Close this and try again.</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--text-muted)]">
              <MessageSquareText size={26} />
              <p className="text-[13.5px] font-medium text-[var(--text-h)]">No quick replies yet</p>
              <p className="max-w-xs text-[12.5px]">Ask an admin to add some in the admin app. They will show up here.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">Nothing matches “{search}”.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    className="w-full rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)]"
                  >
                    <span className="block truncate text-[13.5px] font-semibold text-[var(--text-h)]">{i.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[12px] text-[var(--text-muted)]">{i.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Body>
      )}
    </Dialog>
  )
}
