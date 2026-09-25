import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, X, Link as LinkIcon, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useMeetings, useCreateMeeting, useUpdateMeeting, useMyLeads } from '@/api/queries'
import { useAuthStore } from '@/store/useAuthStore'
import type { CrmContact, CrmMeeting, MeetingStatus } from '@/api/crmApi'

const STATUS_TONE: Record<MeetingStatus, 'accent' | 'success' | 'error'> = {
  scheduled: 'accent',
  completed: 'success',
  cancelled: 'error',
}

const STATUS_OPTIONS: MeetingStatus[] = ['scheduled', 'completed', 'cancelled']

function formatWhen(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MeetingsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const { data: meetings = [], isLoading } = useMeetings()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: leads = [] } = useMyLeads(userId)
  // Contact pages are keyed by lead id; a meeting only knows its contact.
  const leadIdByContact = useMemo(() => new Map(leads.map((l) => [l.contact_id, l.id])), [leads])
  const createMeeting = useCreateMeeting()
  const updateMeeting = useUpdateMeeting()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [meetingSummary, setMeetingSummary] = useState('')
  const [meetingPricing, setMeetingPricing] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editStatus, setEditStatus] = useState<MeetingStatus>('scheduled')
  const [editLink, setEditLink] = useState('')
  const [editPricing, setEditPricing] = useState('')
  const [editSummary, setEditSummary] = useState('')

  function resetForm() {
    setContact(null)
    setMeetingTime('')
    setMeetingType('')
    setMeetingLink('')
    setMeetingSummary('')
    setMeetingPricing('')
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
        pricing: meetingPricing ? Number(meetingPricing) : undefined,
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

  function openMeeting(meeting: CrmMeeting) {
    const leadId = leadIdByContact.get(meeting.contact_id)
    if (!leadId) {
      show({ title: "This meeting's contact isn't in your contacts", tone: 'error' })
      return
    }
    navigate(`/contacts/${leadId}?tab=meeting`)
  }

  function startEdit(meeting: CrmMeeting) {
    setEditingId(meeting.id)
    setEditTime(toDatetimeLocalValue(meeting.meeting_time))
    setEditStatus(meeting.meeting_status)
    setEditLink(meeting.meeting_link ?? '')
    setEditPricing(String(meeting.pricing ?? 0))
    setEditSummary(meeting.meeting_summary ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit() {
    if (!editingId || !editTime) return
    updateMeeting.mutate(
      {
        id: editingId,
        patch: {
          meetingTime: editTime,
          meetingStatus: editStatus,
          meetingLink: editLink.trim(),
          pricing: editPricing ? Number(editPricing) : 0,
          meetingSummary: editSummary.trim(),
        },
      },
      {
        onSuccess: () => {
          show({ title: 'Meeting updated', tone: 'success' })
          setEditingId(null)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update meeting', tone: 'error' }),
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
            <Field label="Pricing" hint="Optional">
              <Input type="number" inputMode="decimal" value={meetingPricing} onChange={(e) => setMeetingPricing(e.target.value)} placeholder="0" />
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
            {meetings.map((meeting) =>
              editingId === meeting.id ? (
                <Card key={meeting.id}>
                  <Card.Body>
                    <div className="space-y-3">
                      <Field label="Date & time">
                        <Input type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                      </Field>
                      <Field label="Status">
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as MeetingStatus)}
                          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Meeting link" hint="Optional">
                        <Input value={editLink} onChange={(e) => setEditLink(e.target.value)} placeholder="https://meet.google.com/…" />
                      </Field>
                      <Field label="Pricing" hint="Optional">
                        <Input type="number" inputMode="decimal" value={editPricing} onChange={(e) => setEditPricing(e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="Summary" hint="Optional">
                        <Textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} rows={2} placeholder="Agenda or notes…" />
                      </Field>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={cancelEdit}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 justify-center"
                          onClick={saveEdit}
                          disabled={!editTime || updateMeeting.isPending}
                        >
                          {updateMeeting.isPending ? 'Saving…' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ) : (
                <Card
                  key={meeting.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openMeeting(meeting)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openMeeting(meeting)
                  }}
                  className="cursor-pointer"
                >
                  <Card.Body>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{meeting.contact_name ?? 'Unknown contact'}</p>
                        <p className="font-mono-num text-[12px] text-[var(--text-muted)]">{formatWhen(meeting.meeting_time)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={STATUS_TONE[meeting.meeting_status]}>{meeting.meeting_status}</Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(meeting)
                          }}
                          title="Edit meeting"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                    {meeting.meeting_type && <p className="mt-2 text-[12px] text-[var(--text-muted)]">{meeting.meeting_type}</p>}
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">Pricing: Rs. {meeting.pricing.toLocaleString()}</p>
                    {meeting.meeting_summary && <p className="mt-1 text-[12px] text-[var(--text-muted)]">{meeting.meeting_summary}</p>}
                    {meeting.meeting_link && (
                      <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-[var(--accent-strong)] hover:underline"
                      >
                        <LinkIcon size={11} /> Join link
                      </a>
                    )}
                  </Card.Body>
                </Card>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
