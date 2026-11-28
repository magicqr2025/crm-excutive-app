import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import type { TeamMember } from '@/api/teamApi'
import { useUpdateStaff } from './teamQueries'
import { SELECT_CLASSES, errorText, staffName } from './teamUtils'

/**
 * Shown when the server refuses to deactivate someone who still has open leads. Choosing where the leads go
 * deactivates them with that choice. Mounted only while open.
 */
export function ReassignLeadsDialog({
  member,
  colleagues,
  message,
  onCancel,
  onDone,
}: {
  member: TeamMember
  colleagues: TeamMember[]
  message: string
  onCancel: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const update = useUpdateStaff()
  // Nothing preselected: handing someone's leads over should be a deliberate choice.
  const [target, setTarget] = useState('')

  function confirm() {
    update.mutate(
      { userId: member.user_id, patch: { status: false, reassign_leads_to: target } },
      {
        onSuccess: () => {
          toast.show({ title: `${staffName(member)} deactivated and leads moved`, tone: 'success' })
          onDone()
        },
        onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
      },
    )
  }

  return (
    <Dialog open onClose={() => !update.isPending && onCancel()} variant="sheet" className="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>Move open leads</Dialog.Title>
        <Dialog.CloseButton onClose={() => !update.isPending && onCancel()} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3">
        <p className="text-[13px] text-[var(--text-muted)]">{message}</p>
        <Field label={`Move ${staffName(member)}'s open leads to`}>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={SELECT_CLASSES}>
            <option value="" disabled>
              Choose…
            </option>
            <option value="unassigned">Leave them unassigned</option>
            {colleagues.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {staffName(c)}
              </option>
            ))}
          </select>
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={update.isPending}>
          Keep active
        </Button>
        <Button variant="danger" onClick={confirm} disabled={!target || update.isPending}>
          {update.isPending ? 'Deactivating…' : 'Deactivate and move'}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
