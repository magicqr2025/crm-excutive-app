import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useMyActivity } from '@/api/queries'
import type { CrmStaffActivity } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { rangeForPreset, rupees, talkTime, toDay, type Preset } from '@/features/performance/performanceUtils'
import { QueryState } from './reportParts'
import { chipClass } from './reportStyles'

type Choice = Preset | 'month' | 'custom'

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'custom', label: 'Custom' },
]

const groups = (s: CrmStaffActivity): { title: string; items: [string, string | number][] }[] => [
  { title: 'Tasks', items: [['Created', s.tasks.created], ['Completed', s.tasks.completed]] },
  {
    title: 'Meetings',
    items: [['Scheduled', s.meetings.scheduled], ['Rescheduled', s.meetings.rescheduled], ['Pending', s.meetings.due], ['Completed', s.meetings.held]],
  },
  { title: 'Follow-ups', items: [['Set', s.followups.created], ['Done', s.followups.done], ['Due', s.followups.due]] },
  { title: 'Calls', items: [['Made', s.calls.total], ['Connected', s.calls.connected], ['Talk time', talkTime(s.calls.talk_seconds)]] },
  {
    title: 'Sales & CRM',
    items: [['New leads', s.leads], ['Deals', s.deals], ['Payments', s.payments.count], ['Received', rupees(s.payments.amount)], ['Notes', s.notes], ['Emails', s.emails]],
  },
]

function PersonCard({ person, top }: { person: CrmStaffActivity; top: number }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="self-start rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="block w-full px-3.5 py-3 text-left">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--text-h)]">{person.name}</span>
          <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
            <span className="font-mono-num text-[15px] font-semibold text-[var(--text-h)]">{person.total_actions}</span> actions
          </span>
          <ChevronDown size={15} aria-hidden className={cn('shrink-0 text-[var(--text-muted)] transition-transform', open && 'rotate-180')} />
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
          <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${top > 0 ? Math.round((person.total_actions / top) * 100) : 0}%` }} />
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--border)] px-3.5 py-3">
          {groups(person).map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{group.title}</p>
              <dl className="mt-1 grid grid-cols-3 gap-2">
                {group.items.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dd className="font-mono-num text-[14px] font-semibold text-[var(--text-h)]">{value}</dd>
                    <dt className="truncate text-[11px] text-[var(--text-muted)]">{label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

/** What each person created and completed in a date range, independent of the report's month. */
export function TeamActivitySection() {
  const [choice, setChoice] = useState<Choice>('month')
  const [custom, setCustom] = useState(() => ({ from: toDay(new Date()), to: toDay(new Date()) }))
  // Computed once per choice: a fresh Date on every render would change the query key and refetch forever.
  const fixed = useMemo(() => {
    if (choice === 'custom') return null
    if (choice === 'month') {
      const now = new Date()
      return { from: toDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDay(now) }
    }
    return rangeForPreset(choice)
  }, [choice])
  const range = fixed ?? (custom.from && custom.to && custom.from <= custom.to ? custom : null)
  const query = useMyActivity(range)
  const staff = [...(query.data?.staff ?? [])].sort((a, b) => b.total_actions - a.total_actions || a.name.localeCompare(b.name))

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--text-h)]">Team activity</h2>
        <p className="text-[12px] text-[var(--text-muted)]">What each person created and completed. Tap a name for the details.</p>
      </div>
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
        {CHOICES.map((c) => (
          <button key={c.value} type="button" aria-pressed={choice === c.value} onClick={() => setChoice(c.value)} className={chipClass(choice === c.value)}>
            {c.label}
          </button>
        ))}
      </div>
      {choice === 'custom' && (
        <div className="grid max-w-sm grid-cols-2 gap-2">
          <Input type="date" aria-label="From" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <Input type="date" aria-label="To" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}
      {!range ? (
        <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">Pick a start day on or before the end day.</p>
      ) : (
        <QueryState query={query} empty={staff.length === 0 ? 'No staff to show.' : null}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {staff.map((person) => (
              <PersonCard key={person.staff_id} person={person} top={staff[0]?.total_actions ?? 0} />
            ))}
          </ul>
        </QueryState>
      )}
    </section>
  )
}
