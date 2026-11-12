import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useRaisePriority } from '@/api/queries'
import type { CrmRaised, RaiseEntityType } from '@/api/crmApi'
import { useAuthStore, useIsAdminOrManager } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/dateFormat'

const NOTE_MAX = 300

/** "Raised by Priya" — shown on an open item someone flagged as "do this first". */
export function RaisedBadge({ raised, className }: { raised: CrmRaised | null | undefined; className?: string }) {
  if (!raised) return null
  return (
    <Badge tone="error" className={cn('gap-1', className)}>
      <BellRing size={10} /> Raised by {raised.by}
      {raised.count > 1 && <span className="tabular-nums">×{raised.count}</span>}
    </Badge>
  )
}

interface Props {
  entityType: RaiseEntityType
  entityId: string
  /** What it is, for the confirmation ("Follow-up with Asha"). */
  itemTitle?: string
  /** Who owns it now; hidden from them (they would be raising it to themselves). */
  assigneeId?: string | null
  assigneeName?: string | null
  /** Who created it: besides admins and managers, the creator may raise it. */
  createdBy?: string | null
  raised?: CrmRaised | null
  overdue?: boolean
  /** An icon only (default), or the icon with a label. */
  labelled?: boolean
  className?: string
}

/**
 * "Raise priority" for an open item (urgent work does not have to be late first): the owner gets a notification and the item
 * is highlighted for them, on their Home too, until it is done. Renders nothing for anyone who may not raise it.
 * The server is the real gate.
 */
export function RaisePriorityButton({ entityType, entityId, itemTitle, assigneeId, assigneeName, createdBy, raised, labelled, className }: Props) {
  const seesAll = useIsAdminOrManager()
  const myId = useAuthStore((s) => s.user?.id)
  const raise = useRaisePriority()
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  const canRaise = seesAll || Boolean(createdBy && myId && createdBy === myId)
  if (!canRaise || (assigneeId && myId && assigneeId === myId)) return null

  const owner = assigneeName || 'The owner'
  const label = raised ? 'Raise again' : 'Raise priority'

  function submit() {
    raise.mutate(
      { entityType, entityId, note },
      {
        onSuccess: () => {
          show({ title: `Raised — ${owner} has been notified`, tone: 'success' })
          setOpen(false)
          setNote('')
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not raise this', tone: 'error' }),
      },
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`${label}: ${itemTitle ?? 'this item'}`}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] font-medium text-[var(--error)] transition-colors hover:brightness-95',
          labelled ? 'h-8 px-2.5 text-[12.5px]' : 'h-8 w-8',
          className,
        )}
      >
        <BellRing size={15} />
        {labelled && label}
      </button>

      {/* Dialog events must not reach a tappable card this sits in. */}
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Dialog open={open} onClose={() => setOpen(false)}>
          <Dialog.Header>
            <Dialog.Title>{label}</Dialog.Title>
            <Dialog.CloseButton onClose={() => setOpen(false)} />
          </Dialog.Header>
          <Dialog.Body className="space-y-3">
            {itemTitle && <p className="rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-[13px] font-medium text-[var(--text-h)]">{itemTitle}</p>}
            <p className="text-[13px] text-[var(--text)]">{owner} will get a notification, and this will be highlighted for them — on their Home too — until it is done.</p>
            {raised && (
              <p className="text-[12px] text-[var(--text-muted)]">
                Last raised by {raised.by} on {formatDateTime(raised.at)}.
              </p>
            )}
            <Field label="Message (optional)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={NOTE_MAX} placeholder="e.g. The client is waiting — please do this today." />
            </Field>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={raise.isPending}>
              <BellRing size={14} /> {raise.isPending ? 'Raising…' : label}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </div>
    </>
  )
}
