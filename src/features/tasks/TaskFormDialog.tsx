import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import type { CrmTask, StaffMember, TaskType } from '@/api/crmApi'
import { SELECT_CLASS, TASK_TYPE_OPTIONS, toDatetimeLocalValue } from './taskUi'
import { TaskContactField } from './TaskContactField'

export interface TaskFormValues {
  title: string
  taskType: TaskType
  /** datetime-local value, or null when empty */
  deadline: string | null
  assignToStaffId: string
  /** '' = no client (only meaningful when creating) */
  contactId: string
}

interface TaskFormDialogProps {
  open: boolean
  onClose: () => void
  staff: StaffMember[]
  userId: string
  /** null = create; a task = edit */
  task: CrmTask | null
  isSaving: boolean
  onSubmit: (values: TaskFormValues) => void
}

export function TaskFormDialog({ open, onClose, ...rest }: TaskFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <TaskForm onClose={onClose} {...rest} />
    </Dialog>
  )
}

function TaskForm({ onClose, staff, userId, task, isSaving, onSubmit }: Omit<TaskFormDialogProps, 'open'>) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [taskType, setTaskType] = useState<TaskType>(task?.task_type ?? 'other')
  const [deadline, setDeadline] = useState(task?.deadline ? toDatetimeLocalValue(task.deadline) : '')
  const [assignee, setAssignee] = useState(task?.assign_to_staff_id ?? userId)
  const [contactId, setContactId] = useState('')

  const valid = title.trim() !== '' && assignee !== ''

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>{task ? 'Edit task' : 'New task'}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <Field label="Task *" hint="Whatever needs doing — e.g. “Send quotation for 50 units”.">
          <Textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)} className={SELECT_CLASS}>
              {TASK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deadline" hint="Optional">
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
        <Field label="Assign to *">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={SELECT_CLASS}>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id}
                {s.user_id === userId ? ' (me)' : ''}
              </option>
            ))}
          </select>
        </Field>
        {!task && (
          <Field label="Client" hint="Optional — leave empty for an internal task.">
            <TaskContactField onChange={setContactId} />
          </Field>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button
          size="sm"
          disabled={!valid || isSaving}
          onClick={() =>
            onSubmit({ title: title.trim(), taskType, deadline: deadline || null, assignToStaffId: assignee, contactId })
          }
        >
          {isSaving ? 'Saving…' : task ? 'Save changes' : 'Create task'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
