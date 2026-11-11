import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/dateFormat'
import { useTaskTypes } from '@/api/queries'
import type { TaskPriority, TaskType } from '@/api/crmApi'
import { DEFAULT_TASK_TYPE, SELECT_CLASS, TASK_PRIORITY_OPTIONS, TASK_STATUS_LABEL, TASK_STATUS_TONE, taskTypeLabel, taskTypeOptions } from '@/features/tasks/taskUi'
import { useAssignableTasks, useAssignChatTask, useAssignExistingChatTask, useChatMembers } from './useTeamChat'

interface Props {
  open: boolean
  onClose: () => void
  channelId: string
  meId: string
  /** Text to start the task with — e.g. the chat message it is made from. */
  initialTitle?: string
}

type Mode = 'new' | 'existing'

// Turns something said in the channel into a real task and posts it back into the chat as a task card.
export function AssignTaskDialog({ open, onClose, channelId, meId, initialTitle = '' }: Props) {
  const { data: members = [] } = useChatMembers(open ? channelId : null)
  const createTask = useAssignChatTask()
  const assignExisting = useAssignExistingChatTask()
  const { show } = useToast()
  const [mode, setMode] = useState<Mode>('new')
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [deadline, setDeadline] = useState('')
  const [taskType, setTaskType] = useState<TaskType>(DEFAULT_TASK_TYPE)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [search, setSearch] = useState('')
  const [pickedTask, setPickedTask] = useState<string | null>(null)
  // One id per dialog session, so a double tap or a retry after a network error posts once.
  const [clientId, setClientId] = useState(() => crypto.randomUUID())
  const { data: openTasks = [], isLoading: loadingTasks } = useAssignableTasks(channelId, search, open && mode === 'existing')
  const { data: adminTypes = [] } = useTaskTypes()
  const typeOptions = taskTypeOptions(adminTypes)

  useEffect(() => {
    if (open) {
      setMode('new')
      setTitle(initialTitle.slice(0, 200))
      setAssignee(meId)
      setDeadline('')
      setTaskType(DEFAULT_TASK_TYPE)
      setPriority('medium')
      setSearch('')
      setPickedTask(null)
      setClientId(crypto.randomUUID())
    }
  }, [open, meId, initialTitle])

  const busy = createTask.isPending || assignExisting.isPending
  const canSubmit = !!assignee && !busy && (mode === 'new' ? !!title.trim() : !!pickedTask)

  async function submit() {
    try {
      if (mode === 'new') {
        await createTask.mutateAsync({
          channelId,
          title: title.trim(),
          assignToStaffId: assignee,
          taskType,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          priority,
          clientMessageId: clientId,
        })
      } else {
        await assignExisting.mutateAsync({ channelId, taskId: pickedTask as string, assignToStaffId: assignee, clientMessageId: clientId })
      }
      show({ title: 'Task assigned', tone: 'success' })
      onClose()
    } catch (err) {
      show({ title: err instanceof Error ? err.message : 'Could not assign the task', tone: 'error' })
    }
  }

  const assignTo = (
    <Field label="Assign to *">
      <select className={SELECT_CLASS} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
        {members
          .filter((m) => m.is_active)
          .map((m) => (
            <option key={m.staff_id} value={m.staff_id}>
              {m.staff_id === meId ? `${m.name} (me)` : m.name}
            </option>
          ))}
      </select>
    </Field>
  )

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        'flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
        mode === value ? 'bg-[var(--surface)] text-[var(--text-h)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
      )}
    >
      {label}
    </button>
  )

  return (
    <Dialog open={open} onClose={onClose}>
      <Dialog.Header>
        <Dialog.Title>Assign a task</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-[var(--surface-hover)] p-1">
          {tab('new', 'New task')}
          {tab('existing', 'Existing task')}
        </div>

        {mode === 'new' ? (
          <Field label="Task *" hint="Whatever needs doing — e.g. “Send quotation for 50 units”.">
            <Textarea data-autofocus value={title} maxLength={200} rows={3} onChange={(e) => setTitle(e.target.value)} aria-label="Task" />
          </Field>
        ) : (
          <div className="space-y-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your open tasks" aria-label="Search tasks" />
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
              {loadingTasks && <PageLoader />}
              {!loadingTasks && openTasks.length === 0 && <li className="px-2 py-3 text-[12.5px] text-[var(--text-muted)]">No open tasks found. Create a new one instead.</li>}
              {openTasks.map((t) => (
                <li key={t.id}>
                  <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-[var(--surface-hover)]', pickedTask === t.id && 'bg-[var(--accent-bg)]')}>
                    <input type="radio" name="existing-task" className="mt-1" checked={pickedTask === t.id} onChange={() => setPickedTask(t.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-h)]">{t.title}</span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">
                        {taskTypeLabel(t.task_type)} · now with {t.assignee_name}
                        {t.deadline ? ` · due ${formatDate(t.deadline)}` : ''}
                      </span>
                    </span>
                    <Badge size="sm" tone={TASK_STATUS_TONE[t.status]}>
                      {TASK_STATUS_LABEL[t.status]}
                    </Badge>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'new' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <select className={SELECT_CLASS} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className={SELECT_CLASS} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {TASK_PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Deadline" hint="Optional">
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
            {assignTo}
          </div>
        ) : (
          assignTo
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {mode === 'new' ? 'Create and assign' : 'Assign task'}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
