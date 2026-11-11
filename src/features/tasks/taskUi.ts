import type { CrmTask, StaffMember, TaskPriority, TaskStatus, TaskType } from '@/api/crmApi'
import { formatDateTime } from '@/lib/dateFormat'

export const DEFAULT_TASK_TYPE = 'general'

// Labels for the built-in type keys. Anything else is an admin-managed type, stored by name.
const BUILT_IN_TYPE_LABELS: Record<string, string> = {
  general: 'General',
  quotation: 'Send quotation',
  call: 'Call',
  demo: 'Demo',
  documents: 'Documents',
  payment_collection: 'Payment collection',
  ticket: 'Ticket',
  other: 'Other',
}

export function taskTypeLabel(type: TaskType): string {
  return BUILT_IN_TYPE_LABELS[type] ?? type
}

/** "General" + the admin's active types, plus `current` if a task already has a type no longer in that list. */
export function taskTypeOptions(adminTypes: { name: string }[], current?: TaskType): { value: TaskType; label: string }[] {
  const options = [{ value: DEFAULT_TASK_TYPE, label: 'General' }, ...adminTypes.map((t) => ({ value: t.name, label: t.name }))]
  if (current && current !== 'ticket' && !options.some((o) => o.value === current)) {
    options.push({ value: current, label: taskTypeLabel(current) })
  }
  return options
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  created: 'Created',
  ongoing: 'Ongoing',
  in_review: 'In review',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const TASK_STATUS_TONE: Record<TaskStatus, 'accent' | 'warning' | 'info' | 'success' | 'neutral'> = {
  created: 'accent',
  ongoing: 'warning',
  in_review: 'info',
  completed: 'success',
  cancelled: 'neutral',
}

export const SELECT_CLASS = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

export function isOpenTask(task: Pick<CrmTask, 'status'>): boolean {
  return task.status === 'created' || task.status === 'ongoing' || task.status === 'in_review'
}

// Display-only: an open task whose deadline has passed.
export function isTaskOverdue(task: Pick<CrmTask, 'status' | 'deadline'>, now: number = Date.now()): boolean {
  return isOpenTask(task) && task.deadline !== null && new Date(task.deadline).getTime() < now
}

// Display-only: a completed task that was finished after its deadline.
export function isTaskCompletedLate(task: Pick<CrmTask, 'status' | 'deadline' | 'completed_at'>): boolean {
  if (task.status !== 'completed' || !task.deadline || !task.completed_at) return false
  return new Date(task.completed_at).getTime() > new Date(task.deadline).getTime()
}

export function formatDeadline(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : formatDateTime(d)
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function staffLabel(staff: StaffMember[], id: string | null): string {
  if (!id) return '—'
  const s = staff.find((u) => u.user_id === id)
  const name = s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : ''
  return name || '—'
}

export interface TaskPermissions {
  edit: boolean
  start: boolean
  /** created / ongoing → in review */
  review: boolean
  /** → completed (from in review this is the reviewer approving it) */
  complete: boolean
  /** in review → ongoing */
  sendBack: boolean
  cancel: boolean
  /** completed → an earlier step */
  reopen: boolean
  /** hand it to someone else, at any step but cancelled */
  reassign: boolean
  /** its assignee, its creator or an admin can take it back to an earlier step */
  moveBack: boolean
  /** the earlier steps it can be taken back to (empty when it can't go back) */
  moveBackTo: TaskStatus[]
}

// The steps a task passes through, in order. Taking it back means going to one before its own.
const PHASE_ORDER: TaskStatus[] = ['created', 'ongoing', 'in_review', 'completed']

// Mirrors crmbackend's tasks.access.js plus the status each action needs.
// Only decides which buttons appear; the server is the real gate.
export function getTaskPermissions(task: CrmTask, userId: string, isAdmin: boolean): TaskPermissions {
  const open = isOpenTask(task)
  const isCreator = userId !== '' && task.created_by === userId
  const isAssignee = userId !== '' && task.assign_to_staff_id === userId
  // In review, the creator decides (the assignee when nobody created it, e.g. system tasks).
  const isReviewer = userId !== '' && (task.created_by ?? task.assign_to_staff_id) === userId
  const inReview = task.status === 'in_review'
  const working = task.status === 'created' || task.status === 'ongoing'
  const managesIt = task.status !== 'cancelled' && (isAdmin || isCreator || isAssignee)
  return {
    // Open: creator/admin. Completed: assignee/admin. Cancelled: locked.
    edit: task.status !== 'cancelled' && (isAdmin || (open && isCreator) || (task.status === 'completed' && isAssignee)),
    start: task.status === 'created' && (isAdmin || isAssignee),
    review: working && (isAdmin || isAssignee),
    complete: inReview ? isAdmin || isReviewer : working && (isAdmin || isAssignee),
    sendBack: inReview && (isAdmin || isReviewer),
    cancel: open && (isAdmin || isCreator),
    reopen: task.status === 'completed' && (isAdmin || isCreator || isAssignee),
    reassign: managesIt,
    moveBack: managesIt,
    moveBackTo: managesIt ? PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(task.status)) : [],
  }
}

/** Who may add, tick off and remove a task's subtasks — the creator, the assignee or an admin (never on a cancelled task). */
export function canChangeSubtasks(task: CrmTask, userId: string, isAdmin: boolean): boolean {
  if (task.status === 'cancelled') return false
  return isAdmin || (userId !== '' && (task.created_by === userId || task.assign_to_staff_id === userId))
}

export function subtaskProgress(task: Pick<CrmTask, 'subtasks'>): { done: number; total: number; percent: number } {
  const items = task.subtasks ?? []
  const done = items.filter((s) => s.done).length
  return { done, total: items.length, percent: items.length === 0 ? 0 : Math.round((done / items.length) * 100) }
}

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export const TASK_PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'accent' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'accent',
  high: 'warning',
  urgent: 'error',
}
