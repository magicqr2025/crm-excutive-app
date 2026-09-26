import type { CrmMeeting, StaffMember } from '@/api/crmApi'
import { cancelReasonLabel, formatMeetingWhen, staffName } from './meetingUi'

interface MeetingDetailsProps {
  meeting: CrmMeeting
  staff: StaffMember[]
}

export function MeetingDetails({ meeting, staff }: MeetingDetailsProps) {
  const cancelledBy = meeting.cancelled_by ? staffName(staff, meeting.cancelled_by) : null
  return (
    <div className="mt-1 space-y-1.5">
      {meeting.meeting_status === 'completed' && meeting.attendees.length > 0 && (
        <p className="text-[12.5px] text-[var(--text)]">
          <span className="text-[12px] text-[var(--text-muted)]">Attended: </span>
          {meeting.attendees.map((a) => a.name).join(', ')}
        </p>
      )}
      {meeting.meeting_summary && (
        <p className="text-[12.5px] text-[var(--text)]">
          <span className="text-[12px] text-[var(--text-muted)]">
            {meeting.meeting_status === 'completed' ? 'Discussion: ' : 'Notes: '}
          </span>
          {meeting.meeting_summary}
        </p>
      )}
      {meeting.tasks.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Next tasks</p>
          <ul className="mt-0.5 space-y-0.5">
            {meeting.tasks.map((t) => (
              <li key={t.id} className="text-[12.5px] text-[var(--text)]">
                {t.title} <span className="text-[var(--text-muted)]">· {t.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {meeting.followup_id && <p className="text-[12px] text-[var(--text-muted)]">A follow-up call was scheduled from this meeting.</p>}
      {meeting.next_meeting_id && <p className="text-[12px] text-[var(--text-muted)]">A follow-up meeting was scheduled from this meeting.</p>}
      {meeting.meeting_status === 'cancelled' && (
        <p className="text-[12.5px] text-[var(--error)]">
          Cancelled: {cancelReasonLabel(meeting.cancel_reason)}
          {meeting.cancel_remark ? ` — ${meeting.cancel_remark}` : ''}
          {cancelledBy ? ` (by ${cancelledBy}${meeting.cancelled_at ? `, ${formatMeetingWhen(meeting.cancelled_at)}` : ''})` : ''}
        </p>
      )}
    </div>
  )
}
