import type { CancelReason, CrmMeeting, MeetingStatus, StaffMember } from '@/api/crmApi'

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const MEETING_STATUS_TONE: Record<MeetingStatus, 'accent' | 'success' | 'error'> = {
  scheduled: 'accent',
  completed: 'success',
  cancelled: 'error',
}

export const CANCEL_REASON_OPTIONS: { value: CancelReason; label: string }[] = [
  { value: 'client_not_available', label: 'Client not available' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'client_declined', label: 'Client declined' },
  { value: 'other', label: 'Other' },
]

export function cancelReasonLabel(reason: CancelReason | null): string {
  return CANCEL_REASON_OPTIONS.find((o) => o.value === reason)?.label ?? ''
}

export const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

// A scheduled meeting whose time has passed and was never completed or cancelled.
// Display-only: nothing changes on the server.
export function isOverdue(meeting: Pick<CrmMeeting, 'meeting_status' | 'meeting_time'>, now: number = Date.now()): boolean {
  return meeting.meeting_status === 'scheduled' && new Date(meeting.meeting_time).getTime() < now
}

export function formatMeetingWhen(iso: string): string {
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

export function staffName(staff: StaffMember[], id: string | null): string {
  if (!id) return 'Unassigned'
  const s = staff.find((u) => u.user_id === id)
  const name = s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : ''
  return name || '—'
}

export interface MeetingPermissions {
  complete: boolean
  cancel: boolean
  reschedule: boolean
  transfer: boolean
}

// Mirrors crmbackend's canManageMeeting plus "must still be scheduled".
// Only decides which buttons appear; the server is the real gate.
export function getMeetingPermissions(meeting: CrmMeeting, userId: string, isAdmin: boolean): MeetingPermissions {
  const assignee = meeting.assign_to_staff_id ?? meeting.created_by
  const isAssignee = isAdmin || (userId !== '' && assignee === userId)
  const isCreator = userId !== '' && meeting.created_by === userId
  const scheduled = meeting.meeting_status === 'scheduled'
  return {
    complete: scheduled && isAssignee,
    transfer: scheduled && isAssignee,
    cancel: scheduled && (isAssignee || isCreator),
    reschedule: scheduled && (isAssignee || isCreator),
  }
}

export function canEditDetails(meeting: Pick<CrmMeeting, 'meeting_status'>): boolean {
  return meeting.meeting_status === 'scheduled'
}
