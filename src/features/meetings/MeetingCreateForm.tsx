import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useCreateMeeting, useStaffList } from '@/api/queries'
import type { MeetingReminder } from '@/api/crmApi'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import { FreeTimeBooking } from './FreeTimeBooking'
import { FreeTimePicker } from './FreeTimePicker'
import { MeetingReminderPicker } from './MeetingReminderPicker'
import { DEFAULT_LENGTH, LENGTH_OPTIONS, SELECT_CLASS } from './meetingUi'

// One way to add a meeting, used on the Meetings page and on a lead's page:
//  - "Booking link": books a free slot from one of your booking links and emails the invite.
//  - "Pick a free time": choose who holds it, how long, and one of their free times. Busy times are
//    never offered, so nobody gets two meetings at once. No invite is sent.

type Mode = 'link' | 'free'

const TYPE_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'in-person', label: 'In person' },
] as const

function lengthLabel(minutes: number) {
  if (minutes < 60 || minutes % 60 !== 0) return `${minutes} minutes`
  const hours = minutes / 60
  return `${hours} hour${hours > 1 ? 's' : ''}`
}

interface MeetingCreateFormProps {
  /** The client; null until one is chosen (Meetings page). */
  contactId: string | null
  onDone: () => void
}

export function MeetingCreateForm({ contactId, onDone }: MeetingCreateFormProps) {
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: staff = [] } = useStaffList()
  const createMeeting = useCreateMeeting()

  const [mode, setMode] = useState<Mode>('free')
  const [assigneeId, setAssigneeId] = useState('') // '' = me
  const [length, setLength] = useState(DEFAULT_LENGTH)
  const [startIso, setStartIso] = useState('')
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]['value']>('online')
  const [meetingLink, setMeetingLink] = useState('')
  const [pricing, setPricing] = useState('')
  const [summary, setSummary] = useState('')
  const [reminder, setReminder] = useState<MeetingReminder | null>(null)

  // The picker clears the time itself when another person, length or day makes it busy.
  const pickTime = useCallback((iso: string) => setStartIso(iso), [])
  const others = staff.filter((s) => s.user_id !== userId)
  const assignee = staff.find((s) => s.user_id === assigneeId)
  const assigneeName = assignee ? `${assignee.first_name ?? ''} ${assignee.last_name ?? ''}`.trim() || 'This person' : 'You'

  function submit() {
    if (!contactId || !startIso) return
    if (reminder && !reminder.remind_24h && !reminder.remind_1h) {
      show({ title: 'Choose when to send the reminder', tone: 'error' })
      return
    }
    createMeeting.mutate(
      {
        contactId,
        meetingTime: startIso,
        meetingType: type,
        durationMinutes: length,
        meetingLink: type === 'online' ? meetingLink.trim() || undefined : undefined,
        meetingSummary: summary.trim() || undefined,
        pricing: pricing ? Number(pricing) : undefined,
        reminder: reminder ?? undefined,
        assignToStaffId: assigneeId || undefined,
      },
      {
        onSuccess: () => {
          show({ title: 'Meeting scheduled', tone: 'success' })
          onDone()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not schedule the meeting', tone: 'error' }),
      },
    )
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex rounded-lg bg-[var(--surface-hover)] p-1">
        {(
          [
            { value: 'free', label: 'Pick a free time' },
            { value: 'link', label: 'Booking link' },
          ] as const
        ).map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              'h-9 flex-1 rounded-md px-3 text-[13px] font-medium transition-colors',
              mode === m.value ? 'bg-[var(--surface)] text-[var(--accent-strong)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <>
          <p className="text-[12px] text-[var(--text-muted)]">Books a slot from your booking link and emails the client an invite.</p>
          <FreeTimeBooking contactId={contactId} onBooked={onDone} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meeting assignee">
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={SELECT_CLASS}>
                <option value="">Me</option>
                {others.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff #${s.user_id}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Length">
              <select value={length} onChange={(e) => setLength(Number(e.target.value))} className={SELECT_CLASS}>
                {LENGTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {lengthLabel(m)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <FreeTimePicker staffId={assigneeId} staffName={assigneeName} durationMinutes={length} value={startIso} onChange={pickTime} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meeting type">
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={SELECT_CLASS}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pricing" hint="Optional">
              <Input type="number" inputMode="decimal" min="0" value={pricing} onChange={(e) => setPricing(e.target.value)} placeholder="0" />
            </Field>
          </div>
          {type === 'online' && (
            <Field label="Meeting link" hint="Optional">
              <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/…" />
            </Field>
          )}
          <Field label="Agenda / notes" hint="Optional">
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="What this meeting is for" />
          </Field>
          <MeetingReminderPicker value={reminder} onChange={setReminder} />
          <Button className="h-11 w-full justify-center" onClick={submit} disabled={!contactId || !startIso || createMeeting.isPending}>
            {createMeeting.isPending ? 'Scheduling…' : 'Schedule meeting'}
          </Button>
          {!contactId && <p className="text-center text-[12px] text-[var(--text-muted)]">Choose a contact first.</p>}
        </>
      )}
    </div>
  )
}
