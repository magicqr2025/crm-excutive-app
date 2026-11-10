import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useUpdateMeetingDetails } from '@/api/queries'
import type { CrmMeeting, MeetingReminder } from '@/api/crmApi'
import { MeetingReminderPicker } from './MeetingReminderPicker'

/** Edits the parts of a still-scheduled meeting that can change: link, pricing, notes and the client reminder. */
export function MeetingEditForm({ meeting, onDone }: { meeting: CrmMeeting; onDone: () => void }) {
  const { show } = useToast()
  const updateDetails = useUpdateMeetingDetails()
  const [link, setLink] = useState(meeting.meeting_link ?? '')
  const [pricing, setPricing] = useState(String(meeting.pricing ?? 0))
  const [summary, setSummary] = useState(meeting.meeting_summary ?? '')
  const [reminder, setReminder] = useState<MeetingReminder | null>(meeting.reminder)

  function save() {
    if (reminder && !reminder.remind_24h && !reminder.remind_1h) {
      show({ title: 'Choose when to send the reminder', tone: 'error' })
      return
    }
    updateDetails.mutate(
      { id: meeting.id, patch: { meetingLink: link.trim(), pricing: pricing ? Number(pricing) : 0, meetingSummary: summary.trim(), reminder } },
      {
        onSuccess: () => {
          show({ title: 'Meeting updated', tone: 'success' })
          onDone()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update meeting', tone: 'error' }),
      },
    )
  }

  return (
    <div className="space-y-3">
      <Field label="Meeting link" hint="Optional">
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" />
      </Field>
      <Field label="Pricing" hint="Optional">
        <Input type="number" inputMode="decimal" value={pricing} onChange={(e) => setPricing(e.target.value)} />
      </Field>
      <Field label="Agenda / notes" hint="Optional">
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
      </Field>
      <MeetingReminderPicker value={reminder} onChange={setReminder} />
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1 justify-center" onClick={save} disabled={updateDetails.isPending}>
          {updateDetails.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
