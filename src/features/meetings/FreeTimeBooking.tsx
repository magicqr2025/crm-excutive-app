import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useBookForContact, useEventTypes, useLinkDays, useLinkSlots } from '@/api/queries'
import { cn } from '@/lib/utils'
import { MonthGrid, monthStartOf } from './MonthGrid'
import { SELECT_CLASS } from './meetingUi'
import { defaultTimezone, formatDuration, formatTime, todayKeyIn } from './schedulingUi'

/**
 * "Pick from free times": choose one of your booking links, a length and a free time, and the contact is
 * booked into it. The invite is emailed and a meeting is created, with the free-time check done for you.
 */
export function FreeTimeBooking({ contactId, onBooked }: { contactId: string | null; onBooked: () => void }) {
  const { show } = useToast()
  const tz = defaultTimezone()
  const { data: links = [], isLoading } = useEventTypes()
  const bookable = useMemo(() => links.filter((l) => l.is_active), [links])

  const [linkId, setLinkId] = useState('')
  const [duration, setDuration] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState(() => monthStartOf(todayKeyIn(tz)))
  const [day, setDay] = useState<string | null>(null)
  const [startUtc, setStartUtc] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const link = bookable.find((l) => l.id === linkId) ?? bookable[0] ?? null
  const activeDuration = duration ?? link?.durations[0]
  const { data: daysData, isLoading: daysLoading } = useLinkDays(link?.id ?? null, tz, activeDuration)
  const { data: slotsData, isLoading: slotsLoading } = useLinkSlots(link?.id ?? null, day, tz, activeDuration)
  const enabledDays = useMemo(() => new Set(daysData?.days ?? []), [daysData])
  const slots = slotsData?.slots ?? []
  const book = useBookForContact()

  function submit() {
    if (!contactId || !link || !startUtc) return
    book.mutate(
      { contact_id: contactId, event_type_id: link.id, start_utc: startUtc, duration: activeDuration, invitee_timezone: tz, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          show({ title: 'Meeting booked. The invite has been emailed.', tone: 'success' })
          onBooked()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not book the meeting', tone: 'error' }),
      },
    )
  }

  if (!contactId) return <p className="text-[13px] text-[var(--text-muted)]">Choose a contact to see free times.</p>
  if (isLoading) return <p className="text-[13px] text-[var(--text-muted)]">Loading your booking links…</p>
  if (bookable.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        You have no active booking link.{' '}
        <Link to="/meetings/links" className="font-medium text-[var(--accent-strong)] underline">
          See your booking links
        </Link>{' '}
        or ask your admin to set one up for you.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Meeting type">
          <select
            className={SELECT_CLASS}
            value={link?.id ?? ''}
            onChange={(e) => {
              setLinkId(e.target.value)
              setDuration(undefined)
              setDay(null)
              setStartUtc(null)
            }}
          >
            {bookable.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration">
          <select
            className={SELECT_CLASS}
            value={activeDuration ?? ''}
            onChange={(e) => {
              setDuration(Number(e.target.value))
              setDay(null)
              setStartUtc(null)
            }}
          >
            {(link?.durations ?? []).map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {daysLoading ? (
        <p className="text-[13px] text-[var(--text-muted)]">Finding free days…</p>
      ) : (
        <MonthGrid
          month={month}
          timezone={tz}
          enabledDays={enabledDays}
          selected={day}
          onSelect={(d) => {
            setDay(d)
            setStartUtc(null)
          }}
          onMonthChange={setMonth}
        />
      )}

      <div className="space-y-2">
        <p className="text-[12px] text-[var(--text-muted)]">{day ? `Free times on ${day} (${tz})` : 'Pick a day to see free times'}</p>
        {slotsLoading && <p className="text-[12px] text-[var(--text-muted)]">Loading…</p>}
        {day && !slotsLoading && slots.length === 0 && <p className="text-[12px] text-[var(--text-muted)]">No free times that day.</p>}
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((s) => (
            <button
              key={s.start_utc}
              type="button"
              onClick={() => setStartUtc(s.start_utc)}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-[12.5px] font-medium',
                startUtc === s.start_utc
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink)]'
                  : 'border-[var(--accent-border)] text-[var(--accent-strong)] hover:bg-[var(--accent-bg)]',
              )}
            >
              {formatTime(s.start_utc, tz)}
            </button>
          ))}
        </div>
      </div>

      <Field label="Notes for this meeting" hint="Optional">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <Button className="w-full justify-center" onClick={submit} disabled={!startUtc || book.isPending}>
        <CalendarCheck size={14} />
        {book.isPending ? 'Booking…' : 'Book meeting'}
      </Button>
    </div>
  )
}
