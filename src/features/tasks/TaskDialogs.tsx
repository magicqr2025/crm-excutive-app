import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useSetTaskStatus, useTaskTypes, useUpdateTask } from '@/api/queries'
import type { CrmTask, StaffMember } from '@/api/crmApi'
import { SELECT_CLASS, staffLabel } from './taskUi'

// Asks before cancelling: a cancelled task is locked, so it only happens on an explicit "Yes, cancel".
export function CancelTaskDialog({ task, onClose }: { task: CrmTask | null; onClose: () => void }) {
  const setStatus = useSetTaskStatus()
  const { show } = useToast()

  function confirm() {
    if (!task) return
    setStatus.mutate(
      { id: task.id, status: 'cancelled' },
      {
        onSuccess: () => {
          show({ title: 'Task cancelled', tone: 'success' })
          onClose()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not cancel the task', tone: 'error' }),
      },
    )
  }

  return (
    <Dialog open={task !== null} onClose={onClose} className="max-w-sm self-center !h-auto rounded-[var(--radius-card)] border border-[var(--border)]">
      <Dialog.Header>
        <Dialog.Title>Cancel task</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body>
        <p className="text-[13px] text-[var(--text)]">
          Are you sure you want to cancel <span className="font-medium text-[var(--text-h)]">{task?.title}</span>? A cancelled task is locked and can no longer be edited or moved.
        </p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          No, keep it
        </Button>
        <Button size="sm" onClick={confirm} disabled={setStatus.isPending} style={{ background: 'var(--error)' }}>
          {setStatus.isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Yes, cancel task
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}

interface ReassignTaskDialogProps {
  /** The task to hand over; null keeps the dialog closed. */
  task: CrmTask | null
  staff: StaffMember[]
  userId: string
  onClose: () => void
}

// Hands a task to someone else at any step. Only the assignee changes.
export function ReassignTaskDialog({ task, staff, userId, onClose }: ReassignTaskDialogProps) {
  return (
    <Dialog open={task !== null} onClose={onClose}>
      {task && <ReassignForm key={task.id} task={task} staff={staff} userId={userId} onClose={onClose} />}
    </Dialog>
  )
}

function ReassignForm({ task, staff, userId, onClose }: Omit<ReassignTaskDialogProps, 'task'> & { task: CrmTask }) {
  const { show } = useToast()
  const { data: types = [] } = useTaskTypes()
  const updateTask = useUpdateTask()
  const [assignee, setAssignee] = useState(task.assign_to_staff_id)

  // A private project's tasks can only go to its members.
  const members = types.find((t) => t.name === task.task_type)?.member_ids ?? []
  const candidates = members.length > 0 ? staff.filter((s) => members.includes(s.user_id) || s.user_id === task.assign_to_staff_id) : staff

  function save() {
    updateTask.mutate(
      { id: task.id, patch: { assignToStaffId: assignee } },
      {
        onSuccess: () => {
          show({ title: `Assigned to ${staffLabel(staff, assignee)}`, tone: 'success' })
          onClose()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not reassign the task', tone: 'error' }),
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Assign to someone else</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3">
        <p className="line-clamp-2 text-[13px] text-[var(--text-muted)]">{task.title}</p>
        <Field label="Assign to *" hint="They are notified, and the task moves to their list. You keep seeing it as its creator.">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={SELECT_CLASS}>
            {candidates.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {`${staffLabel(staff, s.user_id)}${s.user_id === userId ? ' (me)' : ''}${s.is_admin ? ' · Admin' : ''}`}
              </option>
            ))}
          </select>
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={assignee === '' || assignee === task.assign_to_staff_id || updateTask.isPending} onClick={save}>
          {updateTask.isPending ? 'Saving…' : 'Assign'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
