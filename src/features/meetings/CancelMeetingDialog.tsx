import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import type { CancelReason } from '@/api/crmApi'
import { CANCEL_REASON_OPTIONS, SELECT_CLASS } from './meetingUi'

interface CancelMeetingDialogProps {
  open: boolean
  onClose: () => void
  isSaving: boolean
  onSubmit: (input: { reason: CancelReason; remark?: string }) => void
}

export function CancelMeetingDialog({ open, onClose, ...rest }: CancelMeetingDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <CancelMeetingForm onClose={onClose} {...rest} />
    </Dialog>
  )
}

function CancelMeetingForm({ onClose, isSaving, onSubmit }: Omit<CancelMeetingDialogProps, 'open'>) {
  const [reason, setReason] = useState<CancelReason | ''>('')
  const [remark, setRemark] = useState('')

  const remarkRequired = reason === 'other'
  const valid = reason !== '' && (!remarkRequired || remark.trim() !== '')

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Cancel meeting</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <Field label="Why is it cancelled? *">
          <select value={reason} onChange={(e) => setReason(e.target.value as CancelReason | '')} className={SELECT_CLASS}>
            <option value="">Select a reason</option>
            {CANCEL_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={remarkRequired ? 'Remark *' : 'Remark'} hint={remarkRequired ? 'Required when the reason is Other.' : 'Optional'}>
          <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Keep meeting
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={!valid || isSaving}
          onClick={() => reason !== '' && onSubmit({ reason, remark: remark.trim() || undefined })}
        >
          {isSaving ? 'Cancelling…' : 'Cancel meeting'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
