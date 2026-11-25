import { useEffect, useState } from 'react'
import { CalendarX2, Clock } from 'lucide-react'
import { Field, Input } from '@/components/ui/Input'
import { useMeetingFreeTimes } from '@/api/queries'
import { cn } from '@/lib/utils'

// Ported from orm-whatsapp: pick a date, then one of the person's free times that day. Busy times are never
// offered, because one person can't hold two meetings at once (the server refuses a clash too).

const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

interface FreeTimePickerProps {
  /** Whose time; '' = the signed-in user. */
  staffId: string
  /** Used in messages, e.g. "Aarti is fully booked on this day". */
  staffName: string
  durationMinutes: number
  /** The chosen start time (ISO), or '' for none. */
  value: string
  onChange: (iso: string) => void
}

export function FreeTimePicker({ staffId, staffName, durationMinutes, value, onChange }: FreeTimePickerProps) {
  const [today] = useState(() => toDateStr(new Date()))
  const [date, setDate] = useState(today)
  const { data, isLoading, isError, error } = useMeetingFreeTimes({ staffId: staffId || undefined, date, durationMinutes })
  const slots = data?.slots ?? []

  // Another person, length or day can make the chosen time busy: drop it rather than keep a clash.
  useEffect(() => {
    if (data && value && !data.slots.some((s) => s.start === value)) onChange('')
  }, [data, value, onChange])

  const hoursNote =
    data?.hours_source === 'none'
      ? 'No working hours are set, so 9 AM – 9 PM is shown.'
      : data?.hours_name
        ? `Inside the working hours “${data.hours_name}”.`
        : null

  return (
    <div className="space-y-3">
      <Field label="Date *">
        <Input
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            onChange('')
          }}
        />
      </Field>
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-h)]">
          <Clock size={14} /> Free times <span className="text-[var(--error)]">*</span>
        </p>
        {isLoading && <p className="text-[12px] text-[var(--text-muted)]">Checking free times…</p>}
        {isError && <p className="text-[12px] text-[var(--error)]">{error instanceof Error ? error.message : 'Could not load free times'}</p>}
        {data && slots.length === 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning)]">
            <CalendarX2 size={15} /> {staffName || 'This person'} is fully booked on this day. Pick another date.
          </p>
        )}
        {slots.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {slots.map((s) => {
              const active = s.start === value
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onChange(s.start)}
                  aria-pressed={active}
                  className={cn(
                    'font-mono-num h-10 rounded-lg border text-[13px] font-medium transition-colors',
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink)]'
                      : 'border-[var(--border)] text-[var(--text-h)] hover:border-[var(--accent-border)] hover:bg-[var(--surface-hover)]',
                  )}
                >
                  {timeLabel(s.start)}
                </button>
              )
            })}
          </div>
        )}
        {data && data.busy.length > 0 && (
          <p className="text-[12px] text-[var(--text-muted)]">
            Already booked: {data.busy.map((b) => `${timeLabel(b.start)}–${timeLabel(b.end)}${b.with ? ` (${b.with})` : ''}`).join(', ')}
          </p>
        )}
        {hoursNote && <p className="text-[12px] text-[var(--text-muted)]">{hoursNote}</p>}
      </div>
    </div>
  )
}
