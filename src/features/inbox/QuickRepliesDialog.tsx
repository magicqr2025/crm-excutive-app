import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, MessageSquareText, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { useToast } from '@/components/ui/useToast'
import { useCan } from '@/store/useAuthStore'
import { useQuickReplies, useQuickReplyMutations } from '@/api/queries'
import type { QuickReply } from '@/api/quickRepliesApi'
import { QuickReplyForm } from './QuickReplyForm'
import { QuickReplyPreview } from './QuickReplyPreview'

interface QuickRepliesDialogProps {
  open: boolean
  onClose: () => void
  /** The chat's 24-hour window is closed: the library can still be read, but nothing can be sent. */
  canSend: boolean
  isSending: boolean
  onSend: (quickReplyId: string) => void
}

/** The business's ready-made messages: pick one, check how it will look, and send it. Anyone with the inbox edit permission can also add, change and delete them. */
export function QuickRepliesDialog({ open, onClose, canSend, isSending, onSend }: QuickRepliesDialogProps) {
  const { data: items = [], isLoading, isError } = useQuickReplies(open)
  const { remove } = useQuickReplyMutations()
  const canManage = useCan('inbox', 'edit')
  const { show } = useToast()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QuickReply | null>(null)
  // The reply being edited, 'new' for a blank form, null while just browsing.
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q)) : items
  }, [items, search])

  function close() {
    setSearch('')
    setSelected(null)
    setEditing(null)
    setConfirmDelete(false)
    onClose()
  }

  function back() {
    if (editing) setEditing(null)
    else setSelected(null)
    setConfirmDelete(false)
  }

  function removeSelected(item: QuickReply) {
    remove.mutate(item.id, {
      onSuccess: () => {
        setSelected(null)
        setConfirmDelete(false)
        show({ title: 'Quick reply deleted', tone: 'success' })
      },
      onError: (e) => show({ title: e instanceof Error ? e.message : 'Could not delete it', tone: 'error' }),
    })
  }

  const title = editing ? (editing === 'new' ? 'New quick reply' : 'Edit quick reply') : selected ? selected.title : 'Quick replies'

  return (
    <Dialog open={open} onClose={close}>
      <Dialog.Header>
        <div className="flex min-w-0 items-center gap-2">
          {(selected || editing) && (
            <button
              type="button"
              onClick={back}
              aria-label="Back to quick replies"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Dialog.Title className="truncate">{title}</Dialog.Title>
        </div>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>

      {editing ? (
        <QuickReplyForm
          key={editing === 'new' ? 'new' : editing.id}
          existing={editing === 'new' ? null : editing}
          onDone={() => {
            // Back to the list: a changed reply is re-read from it, so drop the stale selection.
            setEditing(null)
            setSelected(null)
          }}
        />
      ) : selected ? (
        <>
          <Dialog.Body className="space-y-3 bg-[var(--bg)]">
            <QuickReplyPreview {...selected} />
            {!canSend && (
              <p className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                The 24-hour window is closed, so only a template message can be sent now.
              </p>
            )}
            {canManage && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
                <Button size="sm" variant="secondary" onClick={() => setEditing(selected)}>
                  <Pencil size={13} /> Edit
                </Button>
                {confirmDelete ? (
                  <>
                    <span className="text-[12.5px] text-[var(--text-muted)]">Delete this reply?</span>
                    <Button size="sm" variant="danger" disabled={remove.isPending} onClick={() => removeSelected(selected)}>
                      {remove.isPending ? 'Deleting…' : 'Yes, delete'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="text-[var(--error)]" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={13} /> Delete
                  </Button>
                )}
              </div>
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
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchBox value={search} onSubmit={setSearch} placeholder="Search quick replies" />
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setEditing('new')} className="shrink-0 gap-1.5">
                <Plus size={13} /> New
              </Button>
            )}
          </div>
          {isLoading ? (
            <PageLoader />
          ) : isError ? (
            <p className="py-6 text-center text-[13px] text-[var(--error)]">Couldn't load quick replies. Close this and try again.</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--text-muted)]">
              <MessageSquareText size={26} />
              <p className="text-[13.5px] font-medium text-[var(--text-h)]">No quick replies yet</p>
              <p className="max-w-xs text-[12.5px]">
                {canManage ? 'Tap New to build a ready-made message you can send in one tap.' : 'Ask an admin to add some. They will show up here.'}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">Nothing matches “{search}”.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setSelected(i)} className="w-full rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)]">
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
