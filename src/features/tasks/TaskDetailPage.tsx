import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Check, Copy, Eye, Pencil, Play, UserPlus, X, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useSetTaskStatus, useStaffList, useTask, useUpdateTask } from '@/api/queries'
import type { CrmTask, StaffMember, TaskStatus } from '@/api/crmApi'
import { useAuthStore, useCan } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import { CancelTaskDialog, ReassignTaskDialog } from './TaskDialogs'
import { TaskComments } from './TaskComments'
import { TaskLog } from './TaskLog'
import { TaskSubtasks } from './TaskSubtasks'
import { TaskWorkNotes } from './TaskWorkNotes'
import { ImageThumbs, TaskWorkImages } from './taskImages'
import {
  SELECT_CLASS,
  TASK_PRIORITY_OPTIONS,
  TASK_PRIORITY_TONE,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  formatDeadline,
  getTaskPermissions,
  isTaskCompletedLate,
  isTaskOverdue,
  staffLabel,
  taskTypeLabel,
} from './taskUi'

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-[var(--text-h)]">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Fact({ label, value, tone }: { label: string; value: ReactNode; tone?: 'error' | 'success' }) {
  const color = tone === 'error' ? 'var(--error)' : tone === 'success' ? 'var(--success)' : 'var(--text-h)'
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium" style={{ color }}>
        {value}
      </dd>
    </div>
  )
}

const STEPS: { status: TaskStatus; label: string }[] = [
  { status: 'created', label: 'Created' },
  { status: 'ongoing', label: 'In progress' },
  { status: 'in_review', label: 'In review' },
  { status: 'completed', label: 'Completed' },
]

// Where the task is on its way to done. A finished task shows every step ticked.
function StatusStepper({ status }: { status: TaskStatus }) {
  const current = Math.max(0, STEPS.findIndex((s) => s.status === status))
  const finished = status === 'completed'
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STEPS.map((step, i) => {
        const done = finished || i < current
        const active = !finished && i === current
        return (
          <li key={step.status} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <span className="flex flex-col items-center gap-1">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold"
                style={{
                  borderColor: done || active ? 'var(--accent)' : 'var(--border)',
                  background: done ? 'var(--accent)' : 'var(--surface)',
                  color: done ? 'var(--ink)' : active ? 'var(--accent-strong)' : 'var(--text-muted)',
                }}
              >
                {done ? <Check size={13} /> : i + 1}
              </span>
              <span className={cn('text-[10.5px] leading-none', done || active ? 'font-medium text-[var(--text-h)]' : 'text-[var(--text-muted)]')}>{step.label}</span>
            </span>
            {i < STEPS.length - 1 && <span className="mx-2 mb-4 h-0.5 flex-1 rounded-full" style={{ background: i < current || finished ? 'var(--accent)' : 'var(--border)' }} />}
          </li>
        )
      })}
    </ol>
  )
}

export function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { data: task, isLoading, error } = useTask(taskId)
  const { data: staff = [] } = useStaffList()

  if (isLoading) return <PageLoader />
  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <XCircle size={24} className="text-[var(--text-muted)]" />
        <p className="text-[14px] font-medium text-[var(--text-h)]">Could not open this task</p>
        <p className="text-[13px] text-[var(--text-muted)]">{error instanceof Error ? error.message : 'It may not exist, or you may not have access to it.'}</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/tasks')}>
          <ArrowLeft size={14} /> Back to tasks
        </Button>
      </div>
    )
  }
  return <TaskView key={task.id} task={task} staff={staff} userId={userId} isAdmin={isAdmin} />
}

function TaskView({ task, staff, userId, isAdmin }: { task: CrmTask; staff: StaffMember[]; userId: string; isAdmin: boolean }) {
  const navigate = useNavigate()
  const { show } = useToast()
  const canAddTask = useCan('tasks', 'add')
  const setStatus = useSetTaskStatus()
  const updateTask = useUpdateTask()
  const [cancelling, setCancelling] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const can = getTaskPermissions(task, userId, isAdmin)
  const overdue = isTaskOverdue(task)
  const completedLate = isTaskCompletedLate(task)
  const assigneeName = staffLabel(staff, task.assign_to_staff_id)
  const images = task.image_urls ?? []
  const hasActions = can.start || can.review || can.complete || can.sendBack || can.cancel || can.reassign || can.moveBackTo.length > 0
  // Mirrors TaskWorkNotes, which renders nothing when there are no notes and the viewer can't write any.
  const showWorkNotes = !!task.work_notes || ((isAdmin || task.assign_to_staff_id === userId) && task.status !== 'cancelled')

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
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg)]">
      <PageHeader
        title={`Task #${task.id}`}
        subtitle={task.title}
        action={
          <div className="flex items-center gap-1.5">
            {canAddTask && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/tasks/new?copy=${task.id}`)} title="Duplicate this task" aria-label="Duplicate task">
                <Copy size={14} />
              </Button>
            )}
            {can.edit && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/tasks/${task.id}/edit`)}>
                <Pencil size={13} /> Edit
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => navigate('/tasks')}>
              <ArrowLeft size={14} /> Back
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
        <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
            <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_OPTIONS.find((o) => o.value === task.priority)?.label ?? task.priority} priority</Badge>
            {overdue && <Badge tone="error">Overdue</Badge>}
            {completedLate && <Badge tone="error">Completed late</Badge>}
            {task.closed_at && <Badge tone="neutral">Closed</Badge>}
          </div>
          <h2 className="whitespace-pre-wrap break-words text-[18px] font-semibold leading-snug text-[var(--text-h)]">{task.title}</h2>
          {task.status === 'cancelled' ? (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-[13px] text-[var(--text-muted)]">This task was cancelled.</p>
          ) : (
            <StatusStepper status={task.status} />
          )}
          <div className="grid gap-3 border-y border-[var(--border)] py-3 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Assigned to</p>
              <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-[var(--text-h)]">
                <Avatar name={assigneeName} size={26} />
                <span className="truncate">{assigneeName}</span>
              </span>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Due</p>
              <span className={cn('flex items-center gap-1.5 text-[13.5px] font-medium', overdue || completedLate ? 'text-[var(--error)]' : 'text-[var(--text-h)]')}>
                <CalendarClock size={14} className="shrink-0" />
                {task.deadline ? formatDeadline(task.deadline) : 'No deadline'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Project</p>
              <span className="text-[13.5px] font-medium text-[var(--text-h)]">{taskTypeLabel(task.task_type)}</span>
            </div>
          </div>
          {task.remark && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3.5 py-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Remark</p>
              <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[var(--text)]">{task.remark}</p>
            </div>
          )}
          {images.length > 0 && <ImageThumbs urls={images} />}
        </section>

        {hasActions && (
          <Panel title="Actions">
            <div className="space-y-2">
              {can.start && (
                <Button className="w-full" variant="outline" disabled={setStatus.isPending} onClick={() => move('ongoing', 'Task started')}>
                  <Play size={14} /> Start
                </Button>
              )}
              {can.review && (
                <Button className="w-full" variant="outline" disabled={setStatus.isPending} onClick={() => move('in_review', 'Sent for review')}>
                  <Eye size={14} /> Send for review
                </Button>
              )}
              {can.sendBack && (
                <Button className="w-full" variant="outline" disabled={setStatus.isPending} onClick={() => move('ongoing', 'Sent back for more work')}>
                  <ArrowLeft size={14} /> Send back for more work
                </Button>
              )}
              {can.complete && (
                <Button className="w-full" disabled={setStatus.isPending} onClick={() => move('completed', 'Task completed')}>
                  <Check size={14} /> {task.status === 'in_review' ? 'Approve' : 'Complete'}
                </Button>
              )}
              {can.moveBackTo.length > 0 && (
                <select
                  aria-label="Move back to"
                  className={SELECT_CLASS}
                  value=""
                  disabled={setStatus.isPending}
                  onChange={(e) => {
                    const to = e.target.value as TaskStatus
                    if (to) move(to, `Task moved back to ${TASK_STATUS_LABEL[to]}`)
                  }}
                >
                  <option value="">Move back to…</option>
                  {can.moveBackTo.map((st) => (
                    <option key={st} value={st}>
                      {TASK_STATUS_LABEL[st]}
                    </option>
                  ))}
                </select>
              )}
              {can.reassign && (
                <Button className="w-full" variant="outline" onClick={() => setReassigning(true)}>
                  <UserPlus size={14} /> Assign to someone else
                </Button>
              )}
              {can.cancel && (
                <Button className="w-full" variant="ghost" disabled={setStatus.isPending} onClick={() => setCancelling(true)} style={{ color: 'var(--error)' }}>
                  <X size={14} /> Cancel task
                </Button>
              )}
            </div>
          </Panel>
        )}

        {task.status === 'completed' && can.edit && (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <span>
              <span className="block text-[13px] font-medium text-[var(--text-h)]">{task.closed_at ? 'Closed' : 'Close task'}</span>
              <span className="block text-[11.5px] text-[var(--text-muted)]">A closed task is out of the way.</span>
            </span>
            <input
              type="checkbox"
              checked={!!task.closed_at}
              disabled={updateTask.isPending}
              aria-label="Closed"
              onChange={(e) =>
                updateTask.mutate(
                  { id: task.id, patch: { closed: e.target.checked } },
                  {
                    onSuccess: () => show({ title: e.target.checked ? 'Task closed' : 'Task reopened', tone: 'success' }),
                    onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not update the task', tone: 'error' }),
                  },
                )
              }
            />
          </label>
        )}

        <TaskSubtasks task={task} userId={userId} isAdmin={isAdmin} />
        <TaskWorkImages task={task} userId={userId} isAdmin={isAdmin} />
        {showWorkNotes && (
          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] [&>div]:mt-0">
            <TaskWorkNotes task={task} userId={userId} isAdmin={isAdmin} />
          </section>
        )}
        <TaskComments task={task} staff={staff} userId={userId} />

        <Panel title="Details">
          <dl className="space-y-3 text-[13px]">
            <Fact label="Created by" value={staffLabel(staff, task.created_by)} />
            <Fact label="Created" value={formatDeadline(task.created_at)} />
            {task.status === 'completed' && task.completed_at && <Fact label="Completed" tone="success" value={formatDeadline(task.completed_at)} />}
            {task.contact_name && <Fact label="Client" value={task.contact_name} />}
          </dl>
        </Panel>

        <TaskLog task={task} />
      </div>

      <CancelTaskDialog task={cancelling ? task : null} onClose={() => setCancelling(false)} />
      <ReassignTaskDialog task={reassigning ? task : null} staff={staff} userId={userId} onClose={() => setReassigning(false)} />
    </div>
  )
}
