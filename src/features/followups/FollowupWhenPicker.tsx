// Ported from orm-whatsapp: quick 1 / 2 / 4 hr buttons or a custom date + time, never in the past.
import { useState } from 'react'
import { Field, Input } from '@/components/ui/Input'

export type WhenPreset = 1 | 2 | 4 | 'custom'
const PRESETS: WhenPreset[] = [1, 2, 4, 'custom']

const pad = (n: number) => String(n).padStart(2, '0')
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export interface When {
  preset: WhenPreset
  date: string
  time: string
}

/** Default: Custom, date = today, time empty (the user must choose). */
export function initialWhen(): When {
  return { preset: 'custom', date: toDateStr(new Date()), time: '' }
}

/** A preset is relative to "now", so re-resolve it at submit time instead of trusting the stored value. */
export function resolveWhen(w: When): { date: string; time: string } {
  if (w.preset === 'custom') return { date: w.date, time: w.time }
  const at = new Date(Date.now() + w.preset * 3_600_000)
  return { date: toDateStr(at), time: toTimeStr(at) }
}

export function whenAt(w: When): Date | null {
  return w.date && w.time ? new Date(`${w.date}T${w.time}`) : null
}

/** True when a chosen date/time is earlier than now (one minute of slack for presets). */
export function whenIsPast(w: When): boolean {
  const at = whenAt(w)
  return at !== null && at.getTime() < Date.now() - 60_000
}

export function whenIsValid(w: When): boolean {
  return w.date !== '' && w.time !== '' && !whenIsPast(w)
}

interface FollowupWhenPickerProps {
  value: When
  onChange: (next: When) => void
}

export function FollowupWhenPicker({ value, onChange }: FollowupWhenPickerProps) {
  // Frozen per mount so the date/time `min` doesn't jitter on every keystroke.
  const [today] = useState(() => toDateStr(new Date()))
  const at = whenAt(value)

  function pick(preset: WhenPreset) {
    if (preset === 'custom') return onChange({ ...value, preset })
    const next = new Date(Date.now() + preset * 3_600_000)
    onChange({ preset, date: toDateStr(next), time: toTimeStr(next) })
  }

  return (
    <div className="space-y-3">
      <Field label="When">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = value.preset === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => pick(p)}
                className={`h-9 rounded-full border px-3.5 text-[14px] font-medium transition-colors ${
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
      {value.preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date *">
            <Input type="date" min={today} value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} />
          </Field>
          <Field label="Time *">
            <Input
              type="time"
              min={value.date === today ? toTimeStr(new Date()) : undefined}
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
            />
          </Field>
        </div>
      ) : (
        at && (
          <p className="text-[14px] text-[var(--text-muted)]">
            Follow-up on {at.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )
      )}
      {whenIsPast(value) && (
        <p className="text-[13px] text-red-600">Follow-up can’t be earlier than the current date and time.</p>
      )}
    </div>
  )
}
