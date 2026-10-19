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

type FollowupPreset = 1 | 2 | 4 | 'custom'
const FOLLOWUP_PRESETS: FollowupPreset[] = [1, 2, 4, 'custom']

const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000)

function CompleteMeetingForm({ onClose, meeting, staff, isSaving, onSubmit }: Omit<CompleteMeetingDialogProps, 'open'>) {
  const owner = meeting.assign_to_staff_id ?? meeting.created_by
  const [summary, setSummary] = useState(meeting.meeting_summary ?? '')
  const [attendees, setAttendees] = useState<string[]>([])
  const [addTask, setAddTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [taskAssignee, setTaskAssignee] = useState(owner ?? '')
  const [addFollowup, setAddFollowup] = useState(false)
  const [followupType, setFollowupType] = useState<'call' | 'meeting'>('call')
  const [followupPreset, setFollowupPreset] = useState<FollowupPreset>('custom')
  const [followupDate, setFollowupDate] = useState(() => toDateStr(new Date()))
  const [followupTime, setFollowupTime] = useState('')
  const [followupAssignee, setFollowupAssignee] = useState(owner ?? '')
  const [followupNote, setFollowupNote] = useState('')

  const today = toDateStr(new Date())
  // A preset is relative to "now", so re-resolve it at submit time rather than trusting the stored value.
  const resolveFollowup = () => {
    if (followupPreset === 'custom') return { date: followupDate, time: followupTime }
    const at = inHours(followupPreset)
    return { date: toDateStr(at), time: toTimeStr(at) }
  }
  const followupAt = followupDate && followupTime ? new Date(`${followupDate}T${followupTime}`) : null
  const followupInPast = followupAt !== null && followupAt.getTime() < Date.now() - 60_000

  const valid =
    summary.trim() !== '' &&
    (!addTask || taskTitle.trim() !== '') &&
    (!addFollowup || (followupDate !== '' && followupTime !== '' && !followupInPast))

  function pickPreset(p: FollowupPreset) {
    setFollowupPreset(p)
    if (p === 'custom') return
    const at = inHours(p)
    setFollowupDate(toDateStr(at))
    setFollowupTime(toTimeStr(at))
  }

  function submit() {
    const fu = resolveFollowup()
    onSubmit({
      meetingSummary: summary.trim(),
      attendeeStaffIds: attendees,
      nextTask: addTask && taskTitle.trim()
        ? {
            title: taskTitle.trim(),
            deadline: taskDeadline || undefined,
            assignToStaffId: taskAssignee || undefined,
          }
        : undefined,
      followup: addFollowup
        ? {
            type: followupType,
            date: fu.date,
            time: fu.time,
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
        <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-h)]">
          <input type="checkbox" checked={addTask} onChange={(e) => setAddTask(e.target.checked)} />
          Add a next task for this client
        </label>
        {addTask && (
          <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <Field label="Next task *" hint="What the client wants us to do next, e.g. “Send quotation”. It is added to Tasks.">
              <Textarea value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} rows={2} />
            </Field>
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
          </div>
        )}
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
            <Field label="When">
              <div className="flex flex-wrap gap-2">
                {FOLLOWUP_PRESETS.map((p) => {
                  const active = followupPreset === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => pickPreset(p)}
                      className={`h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--border)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {p === 'custom' ? 'Custom' : `${p} hr`}
                    </button>
                  )
                })}
              </div>
            </Field>
            {followupPreset === 'custom' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date *">
                  <Input
                    type="date"
                    min={today}
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                  />
                </Field>
                <Field label="Time *">
                  <Input
                    type="time"
                    min={followupDate === today ? toTimeStr(new Date()) : undefined}
                    value={followupTime}
                    onChange={(e) => setFollowupTime(e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              followupAt && (
                <p className="text-[13px] text-[var(--text-muted)]">
                  Follow-up on {followupAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )
            )}
            {followupInPast && (
              <p className="text-[12px] text-red-600">Follow-up can’t be earlier than the current date and time.</p>
            )}
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
