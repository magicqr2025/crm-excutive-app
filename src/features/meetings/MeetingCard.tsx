import { useState } from 'react'
import { Link as LinkIcon, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useStaffList, useUpdateMeetingDetails } from '@/api/queries'
import type { CrmMeeting } from '@/api/crmApi'
import { MeetingActions } from './MeetingActions'
import { MeetingDetails } from './MeetingDetails'
import {
  MEETING_STATUS_LABEL,
  MEETING_STATUS_TONE,
  canEditDetails,
  formatMeetingWhen,
  getMeetingPermissions,
  isOverdue,
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
  const { show } = useToast()
  const updateDetails = useUpdateMeetingDetails()
  const [editing, setEditing] = useState(false)
  const [link, setLink] = useState('')
  const [pricing, setPricing] = useState('')
  const [summary, setSummary] = useState('')

  const overdue = isOverdue(meeting)
  const can = getMeetingPermissions(meeting, userId, isAdmin)
  const canEdit = canEditDetails(meeting) && (isAdmin || meeting.created_by === userId || meeting.assign_to_staff_id === userId)

  function startEdit() {
    setLink(meeting.meeting_link ?? '')
    setPricing(String(meeting.pricing ?? 0))
    setSummary(meeting.meeting_summary ?? '')
    setEditing(true)
  }

  function saveEdit() {
    updateDetails.mutate(
      { id: meeting.id, patch: { meetingLink: link.trim(), pricing: pricing ? Number(pricing) : 0, meetingSummary: summary.trim() } },
      {
        onSuccess: () => {
          show({ title: 'Meeting updated', tone: 'success' })
          setEditing(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update meeting', tone: 'error' }),
      },
    )
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--border)] p-2.5">
        <Field label="Meeting link" hint="Optional">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" />
        </Field>
        <Field label="Pricing" hint="Optional">
          <Input type="number" inputMode="decimal" value={pricing} onChange={(e) => setPricing(e.target.value)} />
        </Field>
        <Field label="Agenda / notes" hint="Optional">
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 justify-center" onClick={saveEdit} disabled={updateDetails.isPending}>
            {updateDetails.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
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
          {overdue && <Badge tone="error">Overdue</Badge>}
          <Badge tone={MEETING_STATUS_TONE[meeting.meeting_status]}>{MEETING_STATUS_LABEL[meeting.meeting_status]}</Badge>
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                startEdit()
              }}
              title="Edit link, pricing and notes"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        Created by {staffName(staff, meeting.created_by)} · Assigned to {staffName(staff, meeting.assign_to_staff_id)}
      </p>
      {meeting.meeting_type && <p className="mt-1 text-[12px] text-[var(--text-muted)]">Type: {meeting.meeting_type}</p>}
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
