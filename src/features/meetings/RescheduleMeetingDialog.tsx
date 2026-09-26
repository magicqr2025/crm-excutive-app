import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { toDatetimeLocalValue } from './meetingUi'

interface RescheduleMeetingDialogProps {
  open: boolean
  onClose: () => void
  currentTime: string
  isSaving: boolean
  onSubmit: (meetingTime: string) => void
}

export function RescheduleMeetingDialog({ open, onClose, ...rest }: RescheduleMeetingDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <RescheduleMeetingForm onClose={onClose} {...rest} />
    </Dialog>
  )
}

function RescheduleMeetingForm({ onClose, currentTime, isSaving, onSubmit }: Omit<RescheduleMeetingDialogProps, 'open'>) {
  const initial = toDatetimeLocalValue(currentTime)
  const [value, setValue] = useState(initial)

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Reschedule meeting</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body>
        <Field label="New date & time *">
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={!value || value === initial || isSaving} onClick={() => onSubmit(value)}>
          {isSaving ? 'Saving…' : 'Reschedule'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
