import { useState, type ReactNode, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, ChevronDown, CalendarClock, Check, CircleCheck, Clock, Copy, Eye, FolderKanban, Pencil, Play, UserPlus, UserRound, X, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { RaisedBadge, RaisePriorityButton } from '@/components/shared/RaisePriority'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useSetTaskStatus, useStaffList, useTask, useUpdateTask } from '@/api/queries'
import type { CrmTask, StaffMember, TaskStatus } from '@/api/crmApi'
import { useAuthStore, useCan } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import { CancelTaskDialog, ReassignMenu } from './TaskDialogs'
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
  isOpenTask,
  isTaskOverdue,
  staffLabel,
  taskTypeLabel,
} from './taskUi'

type ActionTone = 'primary' | 'neutral' | 'danger'

const ACTION_TONE: Record<ActionTone, string> = {
  primary: 'bg-[var(--accent)] text-[var(--ink)] shadow-[var(--shadow-sm)] hover:brightness-95',
  neutral: 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]',
  danger: 'border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error)] hover:brightness-95',
}

// A full-size, thumb-friendly button for the card's footer.
function ActionButton({ tone = 'neutral', icon, children, wide, disabled, onClick, buttonRef, trailing }: { tone?: ActionTone; icon: ReactNode; children: ReactNode; wide?: boolean; disabled?: boolean; onClick: () => void; buttonRef?: RefObject<HTMLButtonElement | null>; trailing?: ReactNode }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-[13.5px] font-semibold transition disabled:opacity-50',
        ACTION_TONE[tone],
        wide && 'col-span-2',
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {trailing}
    </button>
  )
}

// One labelled value in the card's footer grid (created by, dates, client).
function MetaItem({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: 'success' }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--text-muted)]">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
        <dd className="break-words text-[13px] font-medium" style={{ color: tone === 'success' ? 'var(--success)' : 'var(--text-h)' }}>
          {value}
        </dd>
      </div>
    </div>
  )
}

// One of the three key facts (assignee, due date, project) in the card's summary strip.
function FactCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      {children}
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
                className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-shadow', active && 'shadow-[0_0_0_4px_var(--accent-bg)]')}
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
            {i < STEPS.length - 1 && <span className="mx-2 mb-4 h-1 flex-1 rounded-full" style={{ background: i < current || finished ? 'var(--accent)' : 'var(--border)' }} />}
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
        <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          {/* The top rule says where the task stands before any text is read. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: overdue ? 'var(--error)' : task.status === 'completed' ? 'var(--success)' : task.status === 'cancelled' ? 'var(--border)' : 'var(--accent)' }}
          />
          <div className="space-y-5 p-4 pt-5 sm:p-5 sm:pt-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
                <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_OPTIONS.find((o) => o.value === task.priority)?.label ?? task.priority} priority</Badge>
                <RaisedBadge raised={task.raised} />
                {overdue && <Badge tone="error">Overdue</Badge>}
                {completedLate && <Badge tone="error">Completed late</Badge>}
                {task.closed_at && <Badge tone="neutral">Closed</Badge>}
              </div>
              {isOpenTask(task) && (
                <RaisePriorityButton
                  labelled
                  entityType="task"
                  entityId={task.id}
                  itemTitle={task.title}
                  assigneeId={task.assign_to_staff_id}
                  assigneeName={assigneeName}
                  createdBy={task.created_by}
                  raised={task.raised}
                  overdue={overdue}
                  className="sm:ml-auto"
                />
              )}
            </div>

            <h2 className="font-display whitespace-pre-wrap break-words text-[21px] font-semibold leading-tight tracking-tight text-[var(--text-h)]">{task.title}</h2>

            {task.status === 'cancelled' ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-3.5 py-3 text-[13px] text-[var(--text-muted)]">This task was cancelled.</p>
            ) : (
              <div className="rounded-xl bg-[var(--surface-hover)] px-4 pb-3 pt-4">
                <StatusStepper status={task.status} />
              </div>
            )}

            <div className="grid divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <FactCell label="Assigned to">
                <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-[var(--text-h)]">
                  <Avatar name={assigneeName} size={26} />
                  <span className="truncate">{assigneeName}</span>
                </span>
              </FactCell>
              <FactCell label="Due">
                <span className={cn('flex items-center gap-1.5 text-[13.5px] font-medium', overdue || completedLate ? 'text-[var(--error)]' : 'text-[var(--text-h)]')}>
                  <CalendarClock size={15} className="shrink-0" />
                  {task.deadline ? formatDeadline(task.deadline) : 'No deadline'}
                </span>
              </FactCell>
              <FactCell label="Project">
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--text-h)]">
                  <FolderKanban size={15} className="shrink-0 text-[var(--text-muted)]" />
                  {taskTypeLabel(task.task_type)}
                </span>
              </FactCell>
            </div>

            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <MetaItem icon={<UserRound size={14} />} label="Created by" value={staffLabel(staff, task.created_by)} />
              <MetaItem icon={<Clock size={14} />} label="Created" value={formatDeadline(task.created_at)} />
              {task.status === 'completed' && task.completed_at && <MetaItem icon={<CircleCheck size={14} />} label="Completed" tone="success" value={formatDeadline(task.completed_at)} />}
              {task.contact_name && <MetaItem icon={<Building2 size={14} />} label="Client" value={task.contact_name} />}
            </dl>

            {task.remark && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Remark</p>
                <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[var(--text)]">{task.remark}</p>
              </div>
            )}
            {images.length > 0 && <ImageThumbs urls={images} />}
          </div>

          {hasActions && (
            <div className="space-y-2.5 border-t border-[var(--border)] p-4 sm:p-5">
              {can.complete && (
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton tone="primary" wide icon={<Check size={16} />} disabled={setStatus.isPending} onClick={() => move('completed', 'Task completed')}>
                    {task.status === 'in_review' ? 'Approve' : 'Complete'}
                  </ActionButton>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {can.start && (
                  <ActionButton icon={<Play size={15} />} disabled={setStatus.isPending} onClick={() => move('ongoing', 'Task started')}>
                    Start
                  </ActionButton>
                )}
                {can.review && (
                  <ActionButton icon={<Eye size={15} />} disabled={setStatus.isPending} onClick={() => move('in_review', 'Sent for review')}>
                    Send for review
                  </ActionButton>
                )}
                {can.sendBack && (
                  <ActionButton wide icon={<ArrowLeft size={15} />} disabled={setStatus.isPending} onClick={() => move('ongoing', 'Sent back for more work')}>
                    Send back for more work
                  </ActionButton>
                )}
                {can.reassign && (
                  <ReassignMenu
                    task={task}
                    staff={staff}
                    userId={userId}
                    trigger={({ ref, onClick, open, busy }) => (
                      <ActionButton buttonRef={ref} icon={<UserPlus size={15} />} trailing={<ChevronDown size={14} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />} disabled={busy} onClick={onClick}>
                        {busy ? 'Assigning…' : 'Assign to someone else'}
                      </ActionButton>
                    )}
                  />
                )}
                {can.cancel && (
                  <ActionButton tone="danger" icon={<X size={15} />} disabled={setStatus.isPending} onClick={() => setCancelling(true)}>
                    Cancel task
                  </ActionButton>
                )}
              </div>
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
            </div>
          )}
        </section>

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

        <TaskLog task={task} />
        <TaskSubtasks task={task} userId={userId} isAdmin={isAdmin} />
        <TaskWorkImages task={task} userId={userId} isAdmin={isAdmin} />
        {showWorkNotes && (
          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] [&>div]:mt-0">
            <TaskWorkNotes task={task} userId={userId} isAdmin={isAdmin} />
          </section>
        )}
        <TaskComments task={task} staff={staff} userId={userId} />

      </div>

      <CancelTaskDialog task={cancelling ? task : null} onClose={() => setCancelling(false)} />
    </div>
  )
}
