import { CalendarClock, Check, Eye, Play } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'
import { useSetTaskStatus } from '@/api/queries'
import type { CrmTask, StaffMember, TaskStatus } from '@/api/crmApi'
import { RaisedBadge, RaisePriorityButton } from '@/components/shared/RaisePriority'
import { SubtaskProgressLine } from './TaskSubtasks'
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_LABEL, TASK_STATUS_TONE, formatDeadline, getTaskPermissions, isOpenTask, isTaskOverdue, staffLabel, taskTypeLabel } from './taskUi'

interface TaskCardProps {
  task: CrmTask
  staff: StaffMember[]
  userId: string
  isAdmin: boolean
  onOpen: (task: CrmTask) => void
}

// A task in the list: the facts and the next step. Tapping the card opens its own page, which has everything else.
export function TaskCard({ task, staff, userId, isAdmin, onOpen }: TaskCardProps) {
  const setStatus = useSetTaskStatus()
  const { show } = useToast()
  const can = getTaskPermissions(task, userId, isAdmin)
  const overdue = isTaskOverdue(task)

  function move(status: TaskStatus, success: string) {
    setStatus.mutate(
      { id: task.id, status },
      {
        onSuccess: () => show({ title: success, tone: 'success' }),
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not update the task', tone: 'error' }),
      },
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(task)
      }}
      className={`cursor-pointer rounded-lg border p-3 hover:bg-[var(--surface-hover)] ${overdue || task.raised ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 whitespace-pre-wrap break-words text-[13.5px] font-medium text-[var(--text-h)]">{task.title}</p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <RaisedBadge raised={task.raised} />
          {overdue && <Badge tone="error">Overdue</Badge>}
          <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
        </div>
      </div>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        {taskTypeLabel(task.task_type)}
        {task.contact_name ? ` · ${task.contact_name}` : ''}
        {task.meeting_id ? ' · from a meeting' : ''}
        {task.priority === 'high' || task.priority === 'urgent' ? ` · ${TASK_PRIORITY_OPTIONS.find((o) => o.value === task.priority)?.label} priority` : ''}
      </p>
      {task.deadline && (
        <p className={`mt-1 flex items-center gap-1 text-[12px] ${overdue ? 'font-semibold text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
          <CalendarClock size={12} /> Due {formatDeadline(task.deadline)}
        </p>
      )}
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        Assigned to {staffLabel(staff, task.assign_to_staff_id)} · Created by {staffLabel(staff, task.created_by)}
      </p>
      <SubtaskProgressLine task={task} className="mt-1.5" />
      {isOpenTask(task) && (
        <div className="mt-2 empty:hidden" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <RaisePriorityButton
            labelled
            entityType="task"
            entityId={task.id}
            itemTitle={task.title}
            assigneeId={task.assign_to_staff_id}
            assigneeName={staffLabel(staff, task.assign_to_staff_id)}
            createdBy={task.created_by}
            raised={task.raised}
            overdue={overdue}
          />
        </div>
      )}
      {(can.start || can.review || can.complete) && (
        // Dialogs and buttons here must not also open the card.
        <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {can.start && (
            <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => move('ongoing', 'Task started')}>
              <Play size={13} /> Start
            </Button>
          )}
          {can.review && (
            <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => move('in_review', 'Sent for review')}>
              <Eye size={13} /> Review
            </Button>
          )}
          {can.complete && (
            <Button size="sm" disabled={setStatus.isPending} onClick={() => move('completed', 'Task completed')}>
              <Check size={13} /> {task.status === 'in_review' ? 'Approve' : 'Complete'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
