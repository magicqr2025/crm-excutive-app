import { useState } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'
import { useTakeBooking, useUnclaimedBookings } from '@/api/queries'
import { formatMeetingWhen } from './meetingUi'

// Team booking links: meetings a lead booked that no executive has taken yet. The first executive on the link
// to take one gets the meeting and the lead. Hidden when there is nothing waiting.
export function UnclaimedBookingsPanel() {
  const { show } = useToast()
  const { data: waiting = [] } = useUnclaimedBookings()
  const take = useTakeBooking()
  const [busyId, setBusyId] = useState<string | null>(null)

  if (waiting.length === 0) return null

  function run(id: string) {
    setBusyId(id)
    take.mutate(id, {
      onSuccess: () => show({ title: 'You took this meeting', tone: 'success' }),
      onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not take this meeting', tone: 'error' }),
      onSettled: () => setBusyId(null),
    })
  }

  return (
    <section className="mb-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-bg)] p-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-h)]">
        <Users size={14} /> Meetings waiting to be taken ({waiting.length})
      </h3>
      <p className="mb-2 text-[12px] text-[var(--text-muted)]">Booked through your team link. The first to take a meeting gets it and the lead.</p>
      <ul className="space-y-2">
        {waiting.map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[var(--text-h)]">
                {b.invitee_name} · {b.event_title}
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">
                {formatMeetingWhen(b.start_utc)} · {b.duration_minutes} min{b.notes ? ` · ${b.notes}` : ''}
              </p>
            </div>
            <Button size="sm" disabled={busyId === b.id} onClick={() => run(b.id)}>
              {busyId === b.id ? 'Taking…' : 'Take'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
