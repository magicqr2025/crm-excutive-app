import { Field } from '@/components/ui/Input'
import { useEmailTemplates, useZeptomailStatus } from '@/api/queries'
import type { MeetingReminder } from '@/api/crmApi'

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] outline-none focus:border-[var(--accent-border)]'

interface MeetingReminderPickerProps {
  value: MeetingReminder | null
  onChange: (value: MeetingReminder | null) => void
}

// "Email the client a reminder": pick one of the enabled ZeptoMail templates and when to send it.
// Renders nothing when ZeptoMail isn't connected or no template is enabled yet.
export function MeetingReminderPicker({ value, onChange }: MeetingReminderPickerProps) {
  const { data: status } = useZeptomailStatus()
  const { data: templates = [] } = useEmailTemplates()
  if (!status?.configured || templates.length === 0) return null

  return (
    <div className="space-y-2">
      <Field label="Email reminder to client" hint="Optional — emailed to the client before the meeting.">
        <select
          className={SELECT_CLASS}
          value={value?.mapping_id ?? ''}
          onChange={(e) => onChange(e.target.value ? { mapping_id: e.target.value, remind_24h: value?.remind_24h ?? false, remind_1h: value?.remind_1h ?? true } : null)}
        >
          <option value="">Don't send a reminder</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      {value && (
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--text-h)]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={value.remind_24h} onChange={(e) => onChange({ ...value, remind_24h: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
            1 day before
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={value.remind_1h} onChange={(e) => onChange({ ...value, remind_1h: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
            1 hour before
          </label>
          {!value.remind_24h && !value.remind_1h && <span className="text-[12px] text-[var(--error)]">Choose at least one time.</span>}
        </div>
      )}
    </div>
  )
}
