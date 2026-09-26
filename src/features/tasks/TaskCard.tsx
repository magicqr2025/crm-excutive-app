import { CalendarClock, Check, Pencil, Play, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'
import { useSetTaskStatus } from '@/api/queries'
import type { CrmTask, StaffMember } from '@/api/crmApi'
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  formatDeadline,
  getTaskPermissions,
  isTaskOverdue,
  staffLabel,
  taskTypeLabel,
} from './taskUi'

interface TaskCardProps {
  task: CrmTask
  staff: StaffMember[]
  userId: string
  isAdmin: boolean
  onEdit: (task: CrmTask) => void
}

export function TaskCard({ task, staff, userId, isAdmin, onEdit }: TaskCardProps) {
  const setStatus = useSetTaskStatus()
  const { show } = useToast()
  const can = getTaskPermissions(task, userId, isAdmin)
  const overdue = isTaskOverdue(task)

  function move(status: 'ongoing' | 'completed' | 'cancelled', success: string) {
    setStatus.mutate(
      { id: task.id, status },
      {
        onSuccess: () => show({ title: success, tone: 'success' }),
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not update the task', tone: 'error' }),
      },
    )
  }

  return (
    <div className={`rounded-lg border p-3 ${overdue ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 whitespace-pre-wrap break-words text-[13.5px] font-medium text-[var(--text-h)]">{task.title}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {overdue && <Badge tone="error">Overdue</Badge>}
          <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
          {can.edit && (
            <button
              onClick={() => onEdit(task)}
              title="Edit task"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        {taskTypeLabel(task.task_type)}
        {task.contact_name ? ` · ${task.contact_name}` : ''}
        {task.meeting_id ? ' · from a meeting' : ''}
      </p>
      {task.deadline && (
        <p className={`mt-1 flex items-center gap-1 text-[12px] ${overdue ? 'font-semibold text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
          <CalendarClock size={12} /> Due {formatDeadline(task.deadline)}
        </p>
      )}
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        Assigned to {staffLabel(staff, task.assign_to_staff_id)} · Created by {staffLabel(staff, task.created_by)}
      </p>
      {(can.start || can.complete || can.cancel) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {can.start && (
            <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => move('ongoing', 'Task started')}>
              <Play size={13} /> Start
            </Button>
          )}
          {can.complete && (
            <Button size="sm" disabled={setStatus.isPending} onClick={() => move('completed', 'Task completed')}>
              <Check size={13} /> Complete
            </Button>
          )}
          {can.cancel && (
            <Button
              size="sm"
              variant="ghost"
              disabled={setStatus.isPending}
              onClick={() => move('cancelled', 'Task cancelled')}
              className="text-[var(--error)]"
            >
              <X size={13} /> Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
