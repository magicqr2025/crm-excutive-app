import type { CrmTask, StaffMember, TaskStatus, TaskType } from '@/api/crmApi'

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'quotation', label: 'Send quotation' },
  { value: 'call', label: 'Call' },
  { value: 'demo', label: 'Demo' },
  { value: 'documents', label: 'Documents' },
  { value: 'payment_collection', label: 'Payment collection' },
  { value: 'other', label: 'Other' },
]

export function taskTypeLabel(type: TaskType): string {
  return TASK_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? 'Other'
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  created: 'Created',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const TASK_STATUS_TONE: Record<TaskStatus, 'accent' | 'warning' | 'success' | 'neutral'> = {
  created: 'accent',
  ongoing: 'warning',
  completed: 'success',
  cancelled: 'neutral',
}

export const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

export function isOpenTask(task: Pick<CrmTask, 'status'>): boolean {
  return task.status === 'created' || task.status === 'ongoing'
}

// Display-only: an open task whose deadline has passed.
export function isTaskOverdue(task: Pick<CrmTask, 'status' | 'deadline'>, now: number = Date.now()): boolean {
  return isOpenTask(task) && task.deadline !== null && new Date(task.deadline).getTime() < now
}

export function formatDeadline(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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
  complete: boolean
  cancel: boolean
}

// Mirrors crmbackend's tasks.access.js plus the status each action needs.
// Only decides which buttons appear; the server is the real gate.
export function getTaskPermissions(task: CrmTask, userId: string, isAdmin: boolean): TaskPermissions {
  const open = isOpenTask(task)
  const isCreator = userId !== '' && task.created_by === userId
  const isAssignee = userId !== '' && task.assign_to_staff_id === userId
  return {
    edit: open && (isAdmin || isCreator),
    start: task.status === 'created' && (isAdmin || isAssignee),
    complete: open && (isAdmin || isAssignee),
    cancel: open && (isAdmin || isCreator),
  }
}
