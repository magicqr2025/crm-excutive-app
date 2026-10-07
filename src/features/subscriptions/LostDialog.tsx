import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useMarkSubscriptionLost } from '@/api/queries'
import type { CrmSubscription, SubscriptionLostReason } from '@/api/crmApi'
import { LOST_REASON_OPTIONS } from './subscriptionUi'

interface LostDialogProps {
  /** null = closed */
  subscription: CrmSubscription | null
  onClose: () => void
}

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

// Records that the customer declined to renew. Unlike Cancel it keeps a reason
// so churn can be reported on, and it stops the expiry reminders.
export function LostDialog({ subscription, onClose }: LostDialogProps) {
  return (
    <Dialog open={subscription !== null} onClose={onClose}>
      {subscription && <LostForm key={subscription.id} subscription={subscription} onClose={onClose} />}
    </Dialog>
  )
}

function LostForm({ subscription, onClose }: { subscription: CrmSubscription; onClose: () => void }) {
  const markLost = useMarkSubscriptionLost()
  const { show } = useToast()
  const [reason, setReason] = useState<SubscriptionLostReason | ''>('')
  const [note, setNote] = useState('')

  // "Other" needs a note, otherwise the reason says nothing.
  const noteMissing = reason === 'other' && note.trim() === ''
  const valid = reason !== '' && !noteMissing

  function submit() {
    if (reason === '') return
    markLost.mutate(
      { id: subscription.id, reason, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          show({ title: 'Marked as lost', tone: 'success' })
          onClose()
        },
        onError: (err) =>
          show({ title: err instanceof Error ? err.message : 'Could not update the subscription', tone: 'error' }),
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Customer not renewing</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <p className="text-[13px] text-[var(--text-muted)]">
          {subscription.name ?? 'Customer'}
          {subscription.product_name ? ` · ${subscription.product_name}` : ''}
          <br />
          This closes the subscription and stops the renewal reminders. It can’t be undone.
        </p>
        <Field label="Reason *">
          <select value={reason} onChange={(e) => setReason(e.target.value as SubscriptionLostReason | '')} className={SELECT_CLASS}>
            <option value="">Select a reason</option>
            {LOST_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={reason === 'other' ? 'Note *' : 'Note'}
          hint={reason === 'other' ? undefined : 'Optional'}
          error={noteMissing ? 'Please explain the reason' : undefined}
        >
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={!valid || markLost.isPending} onClick={submit}>
          {markLost.isPending ? 'Saving…' : 'Mark as lost'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
