import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import type { CompleteMeetingInput, CrmMeeting, StaffMember } from '@/api/crmApi'
import { AttendeesPicker } from './AttendeesPicker'
import { SELECT_CLASS } from './meetingUi'

interface CompleteMeetingDialogProps {
  open: boolean
  onClose: () => void
  meeting: CrmMeeting
  staff: StaffMember[]
  isSaving: boolean
  onSubmit: (input: CompleteMeetingInput) => void
}

export function CompleteMeetingDialog({ open, onClose, ...rest }: CompleteMeetingDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <CompleteMeetingForm onClose={onClose} {...rest} />
    </Dialog>
  )
}

function staffOptions(staff: StaffMember[]) {
  return staff.map((s) => (
    <option key={s.user_id} value={s.user_id}>
      {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id}
    </option>
  ))
}

function CompleteMeetingForm({ onClose, meeting, staff, isSaving, onSubmit }: Omit<CompleteMeetingDialogProps, 'open'>) {
  const owner = meeting.assign_to_staff_id ?? meeting.created_by
  const [summary, setSummary] = useState(meeting.meeting_summary ?? '')
  const [attendees, setAttendees] = useState<string[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [taskAssignee, setTaskAssignee] = useState(owner ?? '')
  const [addFollowup, setAddFollowup] = useState(false)
  const [followupType, setFollowupType] = useState<'call' | 'meeting'>('call')
  const [followupDate, setFollowupDate] = useState('')
  const [followupTime, setFollowupTime] = useState('')
  const [followupAssignee, setFollowupAssignee] = useState(owner ?? '')
  const [followupNote, setFollowupNote] = useState('')

  const valid = summary.trim() !== '' && (!addFollowup || (followupDate !== '' && followupTime !== ''))

  function submit() {
    onSubmit({
      meetingSummary: summary.trim(),
      attendeeStaffIds: attendees,
      nextTask: taskTitle.trim()
        ? {
            title: taskTitle.trim(),
            deadline: taskDeadline || undefined,
            assignToStaffId: taskAssignee || undefined,
          }
        : undefined,
      followup: addFollowup
        ? {
            type: followupType,
            date: followupDate,
            time: followupTime,
            assignToStaffId: followupAssignee || undefined,
            note: followupNote.trim() || undefined,
          }
        : undefined,
    })
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Complete meeting{meeting.contact_name ? ` — ${meeting.contact_name}` : ''}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <Field label="What was discussed? *">
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
        </Field>
        <Field label="Who from our team attended?" hint="Tick every colleague who was in the meeting.">
          <AttendeesPicker staff={staff} value={attendees} onChange={setAttendees} lockedId={owner} />
        </Field>
        <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
          <Field label="Next task" hint="Optional — what the client wants us to do next, e.g. “Send quotation”. It is added to Tasks.">
            <Textarea value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} rows={2} />
          </Field>
          {taskTitle.trim() !== '' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Deadline" hint="Optional">
                <Input type="datetime-local" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} />
              </Field>
              <Field label="Assign to">
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className={SELECT_CLASS}>
                  {staffOptions(staff)}
                </select>
              </Field>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-h)]">
          <input type="checkbox" checked={addFollowup} onChange={(e) => setAddFollowup(e.target.checked)} />
          Schedule a follow-up with this client
        </label>
        {addFollowup && (
          <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <Field label="Follow-up is a">
              <select
                value={followupType}
                onChange={(e) => setFollowupType(e.target.value as 'call' | 'meeting')}
                className={SELECT_CLASS}
              >
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *">
                <Input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
              </Field>
              <Field label="Time *">
                <Input type="time" value={followupTime} onChange={(e) => setFollowupTime(e.target.value)} />
              </Field>
            </div>
            <Field label="Who follows up">
              <select value={followupAssignee} onChange={(e) => setFollowupAssignee(e.target.value)} className={SELECT_CLASS}>
                {staffOptions(staff)}
              </select>
            </Field>
            <Field label="Note" hint="Optional">
              <Textarea value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} rows={2} />
            </Field>
          </div>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={!valid || isSaving} onClick={submit}>
          {isSaving ? 'Saving…' : 'Complete meeting'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
