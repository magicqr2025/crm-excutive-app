import { useState } from 'react'
import { Link as LinkIcon, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useStaffList } from '@/api/queries'
import type { CrmMeeting } from '@/api/crmApi'
import { MeetingActions } from './MeetingActions'
import { MeetingDetails } from './MeetingDetails'
import { MeetingEditForm } from './MeetingEditForm'
import {
  MEETING_STATUS_LABEL,
  MEETING_STATUS_TONE,
  canEditDetails,
  formatMeetingWhen,
  getMeetingPermissions,
  isOverdue,
  isRescheduled,
  staffName,
} from './meetingUi'

interface MeetingCardProps {
  meeting: CrmMeeting
  userId: string
  isAdmin: boolean
  /** Show the contact's name as the card title (Meetings page); off inside a contact's own tab. */
  showContact?: boolean
  onOpen?: () => void
}

export function MeetingCard({ meeting, userId, isAdmin, showContact = false, onOpen }: MeetingCardProps) {
  const { data: staff = [] } = useStaffList()
  const [editing, setEditing] = useState(false)

  const overdue = isOverdue(meeting)
  const can = getMeetingPermissions(meeting, userId, isAdmin)
  const canEdit = canEditDetails(meeting) && (isAdmin || meeting.created_by === userId || meeting.assign_to_staff_id === userId)

  if (editing) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-2.5">
        <MeetingEditForm meeting={meeting} onDone={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && e.key === 'Enter') onOpen()
      }}
      className={`rounded-lg border p-2.5 ${overdue ? 'border-[var(--error)]' : 'border-[var(--border)]'} ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showContact && (
            <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{meeting.contact_name ?? 'Unknown contact'}</p>
          )}
          <p className={`font-mono-num text-[12.5px] ${overdue ? 'font-semibold text-[var(--error)]' : 'text-[var(--text)]'}`}>
            {formatMeetingWhen(meeting.meeting_time)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {meeting.source === 'booking' && <Badge tone="info">Booked online</Badge>}
          {overdue && <Badge tone="error">Overdue</Badge>}
          {isRescheduled(meeting) ? (
            <Badge tone="warning">Rescheduled</Badge>
          ) : (
            <Badge tone={MEETING_STATUS_TONE[meeting.meeting_status]}>{MEETING_STATUS_LABEL[meeting.meeting_status]}</Badge>
          )}
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              title="Edit link, pricing, notes and reminder"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        {meeting.source === 'booking' && !meeting.created_by ? 'Booked by the lead' : `Created by ${staffName(staff, meeting.created_by)}`} · Assigned to {staffName(staff, meeting.assign_to_staff_id)}
      </p>
      {meeting.meeting_type && <p className="mt-1 text-[12px] text-[var(--text-muted)]">Type: {meeting.meeting_type}</p>}
      {meeting.duration_minutes ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">Length: {meeting.duration_minutes} min</p> : null}
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        Pricing: Rs. <span className="font-mono-num">{meeting.pricing.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </p>
      {meeting.meeting_link && (
        <a
          href={meeting.meeting_link}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-flex items-center gap-1 text-[12px] text-[var(--accent-strong)] hover:underline"
        >
          <LinkIcon size={11} /> Join link
        </a>
      )}
      <MeetingDetails meeting={meeting} staff={staff} />
      <MeetingActions meeting={meeting} can={can} />
    </div>
  )
}
