import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CalendarClock, ListChecks, PhoneCall, TrendingUp, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyActivity, useOverdueFollowupCount } from '@/api/queries'
import type { CrmStaffActivity } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { PRESETS, monthOptions, rangeForAllMonths, rangeForMonth, rangeForPreset, rupees, talkTime, toDay, type Preset } from './performanceUtils'

// A quick preset, one calendar month ('YYYY-MM'), or every month on the list added together.
type Selection = { type: 'preset'; value: Preset } | { type: 'month'; value: string } | { type: 'all' }

type Stats = Omit<CrmStaffActivity, 'staff_id' | 'name'>

interface Metric {
  label: string
  value: (s: Stats) => string
  /** The raw number behind `value`, so zeros can be shown quietly. */
  count: (s: Stats) => number
  hint?: string
}

interface Group {
  title: string
  icon: LucideIcon
  metrics: Metric[]
  /** Spans the whole row on wide screens (the group with the most figures). */
  wide?: boolean
}

const num = (n: number) => n.toLocaleString()

const GROUPS: Group[] = [
  {
    title: 'Calls',
    icon: PhoneCall,
    metrics: [
      { label: 'Made', value: (s) => num(s.calls.total), count: (s) => s.calls.total },
      { label: 'Connected', value: (s) => num(s.calls.connected), count: (s) => s.calls.connected },
      { label: 'Talk time', value: (s) => talkTime(s.calls.talk_seconds), count: (s) => s.calls.talk_seconds },
    ],
  },
  {
    title: 'Follow-ups',
    icon: CalendarClock,
    metrics: [
      { label: 'Set', value: (s) => num(s.followups.created), count: (s) => s.followups.created, hint: 'Follow-ups you created' },
      { label: 'Done', value: (s) => num(s.followups.done), count: (s) => s.followups.done, hint: 'Marked done in this period' },
      { label: 'Due', value: (s) => num(s.followups.due), count: (s) => s.followups.due, hint: 'Dated in this period and still pending' },
    ],
  },
  {
    title: 'Meetings',
    icon: CalendarCheck,
    metrics: [
      { label: 'Scheduled', value: (s) => num(s.meetings.scheduled), count: (s) => s.meetings.scheduled },
      { label: 'Completed', value: (s) => num(s.meetings.held), count: (s) => s.meetings.held },
      { label: 'Pending', value: (s) => num(s.meetings.due), count: (s) => s.meetings.due, hint: 'Dated in this period, not completed yet' },
      { label: 'Rescheduled', value: (s) => num(s.meetings.rescheduled), count: (s) => s.meetings.rescheduled },
    ],
  },
  {
    title: 'Tasks',
    icon: ListChecks,
    metrics: [
      { label: 'Created', value: (s) => num(s.tasks.created), count: (s) => s.tasks.created },
      { label: 'Completed', value: (s) => num(s.tasks.completed), count: (s) => s.tasks.completed },
    ],
  },
  {
    title: 'Sales',
    icon: TrendingUp,
    wide: true,
    metrics: [
      { label: 'New leads', value: (s) => num(s.leads), count: (s) => s.leads },
      { label: 'Deals', value: (s) => num(s.deals), count: (s) => s.deals },
      { label: 'Payments', value: (s) => num(s.payments.count), count: (s) => s.payments.count },
      { label: 'Amount received', value: (s) => rupees(s.payments.amount), count: (s) => s.payments.amount },
      { label: 'Notes', value: (s) => num(s.notes), count: (s) => s.notes },
      { label: 'Emails', value: (s) => num(s.emails), count: (s) => s.emails },
    ],
  },
]

// One explicit class string per layout: two grid-cols utilities on the same element would fight in the cascade.
function columnsFor(group: Group): string {
  if (group.wide) return 'grid-cols-3 md:grid-cols-6'
  if (group.metrics.length === 2) return 'grid-cols-2'
  if (group.metrics.length === 4) return 'grid-cols-2 sm:grid-cols-4'
  return 'grid-cols-3'
}

function GroupCard({ group, stats }: { group: Group; stats: Stats }) {
  const Icon = group.icon
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]',
        group.wide && 'md:col-span-2',
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]">
          <Icon size={15} />
        </span>
        <h2 className="font-display text-[14px] font-semibold text-[var(--text-h)]">{group.title}</h2>
      </header>
      <dl className={cn('grid divide-x divide-[var(--border)]', columnsFor(group))}>
        {group.metrics.map((m) => {
          const zero = m.count(stats) === 0
          return (
            <div key={m.label} title={m.hint} className="min-w-0 px-4 py-3.5">
              <dd className={cn('font-display text-[22px] font-semibold leading-none tabular-nums', zero ? 'text-[var(--text-muted)]/50' : 'text-[var(--text-h)]')}>
                {m.value(stats)}
              </dd>
              <dt className="mt-1.5 truncate text-[11.5px] text-[var(--text-muted)]">{m.label}</dt>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

export function MyPerformancePage() {
  const userId = useAuthStore((s) => s.user?.id)
  const months = useMemo(() => monthOptions(), [])
  const [selection, setSelection] = useState<Selection>({ type: 'month', value: months[0].value })
  // Computed once per choice: a fresh Date on every render would change the query key and refetch forever.
  const range = useMemo(
    () => (selection.type === 'preset' ? rangeForPreset(selection.value) : selection.type === 'month' ? rangeForMonth(selection.value) : rangeForAllMonths()),
    [selection],
  )
  const { data, isLoading, isError, error } = useMyActivity(range)
  // Overdue is how many are late right now, so it only makes sense while the chosen period reaches today.
  const { data: overdue = 0 } = useOverdueFollowupCount(userId ?? '')
  const showOverdue = range.to >= toDay(new Date())

  // The backend returns only the caller's own row; fall back to the totals if ids don't line up.
  const mine: Stats | undefined = data ? (data.staff.find((s) => s.staff_id === userId) ?? (data.staff.length <= 1 ? data.totals : undefined)) : undefined

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader title="My Performance" subtitle="What you created and completed" />
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-8 pt-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Period">
            {PRESETS.map((p) => {
              const active = selection.type === 'preset' && selection.value === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelection({ type: 'preset', value: p.value })}
                  className={cn(
                    'shrink-0 rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
                    active ? 'bg-[var(--accent)] text-[var(--ink)]' : 'border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <select
            aria-label="Month"
            value={selection.type === 'preset' ? '' : selection.type === 'all' ? 'all' : selection.value}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'all') setSelection({ type: 'all' })
              else if (v) setSelection({ type: 'month', value: v })
            }}
            className={cn(
              'h-[31px] rounded-lg border px-2.5 text-[12.5px] font-medium outline-none',
              selection.type === 'preset'
                ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
                : 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink)]',
            )}
          >
            {selection.type === 'preset' && <option value="">Month…</option>}
            <option value="all">All months (last 12)</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">{error instanceof Error ? error.message : "Couldn't load your performance."}</p>
        ) : !mine ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No activity to show for this period.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--accent-border)] bg-[var(--accent-bg)] px-5 py-4">
              <div>
                <p className="text-[12px] font-medium text-[var(--text-muted)]">Total actions</p>
                <p className="font-display text-[34px] font-semibold leading-tight tabular-nums text-[var(--accent-strong)]">{num(mine.total_actions)}</p>
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-3">
                {[
                  { label: 'Calls', value: mine.calls.total },
                  { label: 'Follow-ups done', value: mine.followups.done },
                  { label: 'Tasks done', value: mine.tasks.completed },
                ].map((h) => (
                  <div key={h.label}>
                    <dd className="font-display text-[20px] font-semibold tabular-nums text-[var(--text-h)]">{num(h.value)}</dd>
                    <dt className="text-[11.5px] text-[var(--text-muted)]">{h.label}</dt>
                  </div>
                ))}
                {showOverdue && (
                <Link to="/followups" className="group" title="Open your overdue follow-ups">
                  <dd className={cn('font-display text-[20px] font-semibold tabular-nums', overdue > 0 ? 'text-[var(--error)]' : 'text-[var(--text-h)]')}>{num(overdue)}</dd>
                  <dt className="text-[11.5px] text-[var(--text-muted)] group-hover:underline">Follow-ups overdue</dt>
                </Link>
                )}
              </dl>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {GROUPS.map((g) => (
                <GroupCard key={g.title} group={g} stats={mine} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
