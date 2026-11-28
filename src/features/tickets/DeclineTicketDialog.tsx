import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Input'

const MAX = 1000

interface DeclineTicketDialogProps {
  open: boolean
  busy: boolean
  onClose: () => void
  onDecline: (reason: string) => void
}

// For a ticket the team couldn't or won't resolve. The reason is required and the customer can read it.
export function DeclineTicketDialog({ open, ...rest }: DeclineTicketDialogProps) {
  // Mounted only while open, so every decline starts with an empty box.
  return open ? <DeclineForm {...rest} /> : null
}

function DeclineForm({ busy, onClose, onDecline }: Omit<DeclineTicketDialogProps, 'open'>) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open onClose={onClose}>
      <Dialog.Header>
        <Dialog.Title>Decline ticket</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body>
        <Field label="Reason (required)" htmlFor="decline-reason" hint="The customer can see this reason, so write it for them.">
          <Textarea id="decline-reason" data-autofocus rows={4} maxLength={MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => onDecline(reason.trim())}>
          {busy ? 'Declining…' : 'Decline ticket'}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
