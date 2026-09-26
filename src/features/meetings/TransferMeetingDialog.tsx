import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import type { StaffMember } from '@/api/crmApi'
import { SELECT_CLASS } from './meetingUi'

interface TransferMeetingDialogProps {
  open: boolean
  onClose: () => void
  staff: StaffMember[]
  currentAssigneeId: string | null
  isSaving: boolean
  onSubmit: (input: { toStaffId: string; remark: string }) => void
}

export function TransferMeetingDialog({ open, onClose, ...rest }: TransferMeetingDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <TransferMeetingForm onClose={onClose} {...rest} />
    </Dialog>
  )
}

function TransferMeetingForm({ onClose, staff, currentAssigneeId, isSaving, onSubmit }: Omit<TransferMeetingDialogProps, 'open'>) {
  const [toStaffId, setToStaffId] = useState('')
  const [remark, setRemark] = useState('')
  const options = staff.filter((s) => s.user_id !== currentAssigneeId)

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Transfer meeting</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <Field label="Transfer to *">
          <select value={toStaffId} onChange={(e) => setToStaffId(e.target.value)} className={SELECT_CLASS}>
            <option value="">Select a colleague</option>
            {options.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason *" hint="e.g. the client speaks a language this person doesn't. The lead itself does not move.">
          <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button
          size="sm"
          disabled={!toStaffId || remark.trim() === '' || isSaving}
          onClick={() => onSubmit({ toStaffId, remark: remark.trim() })}
        >
          {isSaving ? 'Transferring…' : 'Transfer'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
