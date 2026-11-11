import { type ReactNode, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, ExternalLink, Pencil, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useMeeting, useStaffList } from '@/api/queries'
import type { CrmMeeting } from '@/api/crmApi'
import { useAuthStore } from '@/store/useAuthStore'
import { telHref } from '@/lib/whatsapp'
import { MeetingActions } from './MeetingActions'
import { MeetingDetails } from './MeetingDetails'
import { MeetingEditForm } from './MeetingEditForm'
import { MEETING_STATUS_LABEL, MEETING_STATUS_TONE, canEditDetails, formatMeetingWhen, getMeetingPermissions, isOverdue, isRescheduled, staffName } from './meetingUi'

const capitalize = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—')

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] font-medium text-[var(--text-h)]">{children}</dd>
    </div>
  )
}

function Person({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} size={24} />
      {name}
    </span>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <h2 className="text-[14px] font-semibold text-[var(--text-h)]">{title}</h2>
      {children}
    </section>
  )
}

const MUTED = <span className="font-normal text-[var(--text-muted)]">—</span>

export function MeetingDetailPage() {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const { data: meeting, isLoading, error } = useMeeting(meetingId)

  if (isLoading) return <PageLoader />
  if (!meeting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <XCircle size={24} className="text-[var(--text-muted)]" />
        <p className="text-[14px] font-medium text-[var(--text-h)]">Could not open this meeting</p>
        <p className="text-[13px] text-[var(--text-muted)]">{error instanceof Error ? error.message : 'It may not exist, or you may not have access to it.'}</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/meetings')}>
          <ArrowLeft size={14} /> Back to meetings
        </Button>
      </div>
    )
  }
  return <Loaded key={meeting.id} meeting={meeting} />
}

function Loaded({ meeting }: { meeting: CrmMeeting }) {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: staff = [] } = useStaffList()
  const [editing, setEditing] = useState(false)

  const overdue = isOverdue(meeting)
  const can = getMeetingPermissions(meeting, userId, false)
  const canEdit = canEditDetails(meeting) && (meeting.created_by === userId || meeting.assign_to_staff_id === userId)
  const assignee = staffName(staff, meeting.assign_to_staff_id ?? meeting.created_by)
  const createdBy = meeting.source === 'booking' && !meeting.created_by ? 'Booked by the lead' : staffName(staff, meeting.created_by)
  const completed = meeting.meeting_status === 'completed'
  const hasMore =
    (completed && meeting.attendees.length > 0) ||
    (meeting.meeting_status === 'scheduled' && meeting.reminder) ||
    meeting.tasks.length > 0 ||
    meeting.followup_id ||
    meeting.next_meeting_id ||
    meeting.meeting_status === 'cancelled'

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title={meeting.contact_name ?? 'Unknown contact'}
        subtitle={`Meeting #${meeting.id}`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/meetings')}>
              <ArrowLeft size={14} /> Back
            </Button>
            {canEdit && !editing && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <Panel title="Meeting details">
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {meeting.source === 'booking' && <Badge tone="info">Booked online</Badge>}
              {overdue && <Badge tone="error">Overdue</Badge>}
              {isRescheduled(meeting) ? (
                <Badge tone="warning">Rescheduled</Badge>
              ) : (
                <Badge tone={MEETING_STATUS_TONE[meeting.meeting_status]}>{MEETING_STATUS_LABEL[meeting.meeting_status]}</Badge>
              )}
            </div>

            <div className={`mt-3 flex items-center gap-3 rounded-lg px-3 py-3 ${overdue ? 'bg-[var(--error-bg)] text-[var(--error)]' : 'bg-[var(--accent-bg)] text-[var(--accent-strong)]'}`}>
              <CalendarClock size={18} />
              <div>
                <p className="text-[11.5px] opacity-80">Meeting date &amp; time</p>
                <p className="text-[14px] font-semibold tabular-nums">{formatMeetingWhen(meeting.meeting_time)}</p>
              </div>
            </div>

            {editing ? (
              <div className="mt-4">
                <MeetingEditForm meeting={meeting} onDone={() => setEditing(false)} />
              </div>
            ) : (
              <dl className="mt-4 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
                <Meta label="Contact">
                  {meeting.lead_id ? (
                    <Link to={`/contacts/${meeting.lead_id}`} className="text-[var(--accent-strong)] underline">
                      {meeting.contact_name ?? 'Unknown contact'}
                    </Link>
                  ) : (
                    (meeting.contact_name ?? 'Unknown contact')
                  )}
                </Meta>
                <Meta label="Phone">
                  {meeting.contact_phone ? (
                    <a href={telHref(meeting.contact_phone)} className="tabular-nums text-[var(--accent-strong)] underline">
                      {meeting.contact_phone}
                    </a>
                  ) : (
                    'Not added'
                  )}
                </Meta>
                <Meta label="Email">
                  {meeting.contact_email ? (
                    <a href={`mailto:${meeting.contact_email}`} className="break-all text-[var(--accent-strong)] underline">
                      {meeting.contact_email}
                    </a>
                  ) : (
                    'Not added'
                  )}
                </Meta>
                <Meta label="Type">{capitalize(meeting.meeting_type)}</Meta>
                <Meta label="Length">{meeting.duration_minutes ?? 30} min</Meta>
                <Meta label="Pricing">
                  Rs. <span className="tabular-nums">{(meeting.pricing ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </Meta>
                <Meta label="Source">{meeting.source === 'booking' ? 'Booked online' : 'Added manually'}</Meta>
                <Meta label="Join link">
                  {meeting.meeting_link ? (
                    <a href={meeting.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent-strong)] underline">
                      Open link <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="font-normal text-[var(--text-muted)]">Not added</span>
                  )}
                </Meta>
              </dl>
            )}
          </Panel>

          {!editing && (
            <Panel title={completed ? 'Discussion' : 'Notes'}>
              {meeting.meeting_summary ? (
                <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-[var(--text)]">{meeting.meeting_summary}</p>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--text-muted)]">{completed ? 'No discussion was recorded.' : 'No notes added.'}</p>
              )}
              {meeting.customer_overview && (
                <div className="mt-4 border-t border-[var(--border)] pt-3">
                  <p className="text-[11.5px] text-[var(--text-muted)]">Customer overview</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] text-[var(--text)]">{meeting.customer_overview}</p>
                </div>
              )}
            </Panel>
          )}

          {!editing && hasMore && (
            <Panel title="Outcome & follow-ups">
              <MeetingDetails meeting={meeting} staff={staff} hideSummary />
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="People">
            <dl className="mt-3 space-y-3.5">
              <Meta label="Assigned to">
                <Person name={assignee} />
              </Meta>
              <Meta label="Created by">{meeting.created_by ? <Person name={createdBy} /> : createdBy}</Meta>
              {meeting.meeting_status === 'cancelled' && (
                <Meta label="Cancelled by">{meeting.cancelled_by ? <Person name={staffName(staff, meeting.cancelled_by)} /> : MUTED}</Meta>
              )}
            </dl>
          </Panel>

          <Panel title="Timeline">
            <dl className="mt-3 space-y-3.5">
              <Meta label="Created">
                <span className="tabular-nums">{meeting.created_at ? formatMeetingWhen(meeting.created_at) : '—'}</span>
              </Meta>
              <Meta label="Scheduled for">
                <span className="tabular-nums">{formatMeetingWhen(meeting.meeting_time)}</span>
              </Meta>
              {meeting.updated_at && (
                <Meta label={completed ? 'Completed / last updated' : 'Last updated'}>
                  <span className="tabular-nums">{formatMeetingWhen(meeting.updated_at)}</span>
                </Meta>
              )}
              {meeting.cancelled_at && (
                <Meta label="Cancelled">
                  <span className="tabular-nums">{formatMeetingWhen(meeting.cancelled_at)}</span>
                </Meta>
              )}
            </dl>
          </Panel>

          {(meeting.logs ?? []).length > 0 && (
            <Panel title="Meeting log">
              <ul className="mt-3 space-y-3">
                {[...(meeting.logs ?? [])].reverse().map((log) => (
                  <li key={log.id} className="text-[13px] text-[var(--text)]">
                    <p>
                      Rescheduled{log.from_time ? ` from ${formatMeetingWhen(log.from_time)}` : ''}
                      {log.to_time ? ` to ${formatMeetingWhen(log.to_time)}` : ''}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                      {log.actor_id ? `by ${staffName(staff, log.actor_id)}` : 'by the client'} · {formatMeetingWhen(log.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {!editing && Object.values(can).some(Boolean) && (
            <Panel title="Actions">
              <MeetingActions meeting={meeting} can={can} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
