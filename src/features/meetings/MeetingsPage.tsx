import { useState } from 'react'
import { Plus, X, Link as LinkIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useMeetings, useCreateMeeting } from '@/api/queries'
import type { CrmContact, MeetingStatus } from '@/api/crmApi'

const STATUS_TONE: Record<MeetingStatus, 'accent' | 'success' | 'error'> = {
  scheduled: 'accent',
  completed: 'success',
  cancelled: 'error',
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function MeetingsPage() {
  const { data: meetings = [], isLoading } = useMeetings()
  const createMeeting = useCreateMeeting()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [meetingSummary, setMeetingSummary] = useState('')

  function resetForm() {
    setContact(null)
    setMeetingTime('')
    setMeetingType('')
    setMeetingLink('')
    setMeetingSummary('')
  }

  function submit() {
    if (!contact || !meetingTime) return
    createMeeting.mutate(
      {
        contactId: contact.id,
        meetingTime,
        meetingType: meetingType.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        meetingSummary: meetingSummary.trim() || undefined,
      },
      {
        onSuccess: () => {
          show({ title: 'Meeting scheduled', tone: 'success' })
          resetForm()
          setFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to schedule meeting', tone: 'error' }),
      },
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Meetings"
        subtitle={`${meetings.length} meeting${meetings.length === 1 ? '' : 's'} on record`}
        action={
          <Button size="sm" onClick={() => setFormOpen((v) => !v)} className="gap-1.5">
            {formOpen ? <X size={14} /> : <Plus size={14} />}
            {formOpen ? 'Close' : 'Schedule'}
          </Button>
        }
      />
      <div className="p-4">
        {formOpen && (
          <div className="mb-4 space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <Field label="Contact">
              <ContactPicker value={contact} onChange={setContact} />
            </Field>
            <Field label="Date & time">
              <Input type="datetime-local" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
            </Field>
            <Field label="Type" hint="Optional — e.g. Demo, Follow-up call">
              <Input value={meetingType} onChange={(e) => setMeetingType(e.target.value)} placeholder="Demo" />
            </Field>
            <Field label="Meeting link" hint="Optional">
              <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/…" />
            </Field>
            <Field label="Summary" hint="Optional">
              <Textarea value={meetingSummary} onChange={(e) => setMeetingSummary(e.target.value)} rows={3} placeholder="Agenda or notes…" />
            </Field>
            <Button className="w-full justify-center" onClick={submit} disabled={!contact || !meetingTime || createMeeting.isPending}>
              {createMeeting.isPending ? 'Saving…' : 'Schedule Meeting'}
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No meetings yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <Card key={meeting.id}>
                <Card.Body>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{meeting.contact_name ?? 'Unknown contact'}</p>
                      <p className="font-mono-num text-[12px] text-[var(--text-muted)]">{formatWhen(meeting.meeting_time)}</p>
                    </div>
                    <Badge tone={STATUS_TONE[meeting.meeting_status]}>{meeting.meeting_status}</Badge>
                  </div>
                  {meeting.meeting_type && <p className="mt-2 text-[12px] text-[var(--text-muted)]">{meeting.meeting_type}</p>}
                  {meeting.meeting_link && (
                    <a
                      href={meeting.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-[var(--accent-strong)] hover:underline"
                    >
                      <LinkIcon size={11} /> Join link
                    </a>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
