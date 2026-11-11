import { type InputHTMLAttributes, useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

// The browser's own date input shows dates in the phone/PC locale (11/21/2026 on a US setting).
// This one always shows dd/mm/yyyy (and 24-hour time) but keeps the same value format as <input type="date">
// ("yyyy-MM-dd" / "yyyy-MM-ddTHH:mm"), so callers don't change.

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'>

interface DateFieldProps extends NativeProps {
  withTime: boolean
  value: string
  onValueChange: (value: string) => void
  min?: string
  max?: string
}

/** "2026-11-21T18:24" → "21/11/2026 18:24"; "" → "" */
function toDisplay(value: string, withTime: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value)
  if (!m) return ''
  const date = `${m[3]}/${m[2]}/${m[1]}`
  return withTime ? `${date} ${m[4] ?? '00'}:${m[5] ?? '00'}` : date
}

/** Digits typed so far → "dd/mm/yyyy hh:mm" with the separators put in. */
function mask(raw: string, withTime: boolean): string {
  const d = raw.replace(/\D/g, '').slice(0, withTime ? 12 : 8)
  let out = d.slice(0, 2)
  if (d.length > 2) out += `/${d.slice(2, 4)}`
  if (d.length > 4) out += `/${d.slice(4, 8)}`
  if (withTime && d.length > 8) out += ` ${d.slice(8, 10)}`
  if (withTime && d.length > 10) out += `:${d.slice(10, 12)}`
  return out
}

/** A complete, real calendar date (and time) → ISO value; anything else → null. */
function toValue(display: string, withTime: boolean): string | null {
  const m = withTime ? /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(display) : /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display)
  if (!m) return null
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  if (!withTime) return iso
  if (Number(m[4]) > 23 || Number(m[5]) > 59) return null
  return `${iso}T${m[4]}:${m[5]}`
}

export function DateField({ withTime, value, onValueChange, min, max, className, disabled, placeholder, ...rest }: DateFieldProps) {
  const [draft, setDraft] = useState(() => toDisplay(value, withTime))
  const pickerRef = useRef<HTMLInputElement>(null)

  // Follow the value when it changes from outside (a quick-pick button, a reset…), without
  // clobbering what is being typed when it already means the same thing.
  useEffect(() => {
    setDraft((current) => (toValue(current, withTime) === value ? current : toDisplay(value, withTime)))
  }, [value, withTime])

  const inRange = (v: string) => {
    const lo = min ? (min.length < v.length ? `${min}T00:00` : min) : ''
    const hi = max ? (max.length < v.length ? `${max}T23:59` : max) : ''
    return (!lo || v >= lo) && (!hi || v <= hi)
  }

  function onType(raw: string) {
    // Deleting keeps what's left instead of re-adding a separator the user just removed.
    const next = raw.length < draft.length ? raw.replace(/[^\d/ :]/g, '') : mask(raw, withTime)
    setDraft(next)
    if (next === '') return onValueChange('')
    const parsed = toValue(next, withTime)
    if (parsed && inRange(parsed)) onValueChange(parsed)
  }

  function onBlur() {
    // Unfinished, impossible or out-of-range text goes back to the last good value.
    const parsed = toValue(draft, withTime)
    if (draft !== '' && !(parsed && inRange(parsed))) setDraft(toDisplay(value, withTime))
  }

  function openPicker() {
    const el = pickerRef.current
    if (!el || disabled) return
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }

  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={draft}
        placeholder={placeholder ?? (withTime ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy')}
        onChange={(e) => onType(e.target.value)}
        onBlur={onBlur}
        data-slot="input"
        className={cn(
          'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 pr-10 text-sm text-[var(--text-h)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-border)] disabled:opacity-60',
          className,
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        aria-label="Pick a date"
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-h)]"
      >
        <CalendarDays size={16} />
      </button>
      {/* The browser's calendar, used only as a picker; what is shown is the dd/mm/yyyy text above. */}
      <input
        ref={pickerRef}
        type={withTime ? 'datetime-local' : 'date'}
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onValueChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  )
}
