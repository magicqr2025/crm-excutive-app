import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/lib/dateFormat'
import { cn } from '@/lib/utils'
import { rupees, toDay } from '@/features/performance/performanceUtils'
import { TeamHeader } from '@/features/team/teamParts'
import { SELECT_CLASSES } from '@/features/team/teamUtils'
import { SubscriberGrowthWidget, TargetAchievedWidget } from './OverviewWidgets'
import { useDashboardSummary, useOpenTickets, usePublicTickets } from './reportQueries'
import { QueryState } from './reportParts'

type Preset = 'default' | 'today' | 'next7' | 'last7' | 'last30' | 'month' | 'custom'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'default', label: 'Last 4 + next 3 days' },
  { value: 'today', label: 'Today' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom dates' },
]

/** The window as ISO instants, `to` exclusive. Empty = the server's default (last 4 days and next 3). */
function windowFor(preset: Preset, custom: { from: string; to: string }): { from?: string; to?: string } {
  const now = new Date()
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  const between = (from: Date, to: Date) => ({ from: from.toISOString(), to: to.toISOString() })
  switch (preset) {
    case 'today':
      return between(day(0), day(1))
    case 'next7':
      return between(day(0), day(7))
    case 'last7':
      return between(day(-6), day(1))
    case 'last30':
      return between(day(-29), day(1))
    case 'month':
      return between(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1))
    case 'custom': {
      if (!custom.from || !custom.to || custom.from > custom.to) return {}
      const end = new Date(`${custom.to}T00:00:00`)
      end.setDate(end.getDate() + 1)
      return between(new Date(`${custom.from}T00:00:00`), end)
    }
    default:
      return {}
  }
}

interface ListRow {
  id: string
  title: string
  detail: string
  right?: string
  to: string | null
  late?: boolean
}

function SummaryList({
  title,
  count,
  to,
  query,
  rows,
  emptyText,
}: {
  title: string
  count: string | number
  to: string
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  rows: ListRow[]
  emptyText: string
}) {
  return (
    <section className="self-start overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
      <Link to={to} className="flex min-h-14 items-center gap-2 border-b border-[var(--border)] px-3.5 py-2.5 hover:bg-[var(--surface-hover)]">
        <span className="min-w-0 flex-1">
          <span className="block font-mono-num text-[20px] font-semibold leading-none text-[var(--text-h)]">{query.isLoading ? '…' : count}</span>
          <span className="block truncate text-[12.5px] text-[var(--text-muted)]">{title}</span>
        </span>
        <span className="text-[12px] font-medium text-[var(--accent-strong)]">View all</span>
        <ArrowRight size={14} aria-hidden className="text-[var(--accent-strong)]" />
      </Link>
      <QueryState query={query} empty={rows.length === 0 ? emptyText : null}>
        <ul className="divide-y divide-[var(--border)]">
          {rows.slice(0, 5).map((row) => {
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-[var(--text-h)]">{row.title}</span>
                  <span className={cn('block truncate text-[12px]', row.late ? 'font-medium text-[var(--error)]' : 'text-[var(--text-muted)]')}>{row.detail}</span>
                </span>
                {row.right && <span className="shrink-0 font-mono-num text-[12.5px] font-semibold text-[var(--text-h)]">{row.right}</span>}
              </>
            )
            const classes = 'flex items-center gap-3 px-3.5 py-2.5'
            return (
              <li key={row.id}>
                {row.to ? (
                  <Link to={row.to} className={cn(classes, 'hover:bg-[var(--surface-hover)]')}>
                    {body}
                  </Link>
                ) : (
                  <div className={classes}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      </QueryState>
    </section>
  )
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')
const contactLink = (leadId: string | null) => (leadId ? `/contacts/${leadId}` : null)

export function BusinessOverviewPage() {
  const [preset, setPreset] = useState<Preset>('default')
  const [custom, setCustom] = useState(() => ({ from: toDay(new Date()), to: toDay(new Date()) }))
  // Memoised so the query key stays the same between renders.
  const range = useMemo(() => windowFor(preset, custom), [preset, custom])
  const summary = useDashboardSummary(range)
  const tickets = useOpenTickets()
  const publicTickets = usePublicTickets()
  const cards = summary.data?.cards
  // The time the page was opened; good enough to mark what is late.
  const [now] = useState(() => Date.now())
  const late = (iso: string | null) => !!iso && new Date(iso).getTime() < now

  const leadRows = (rows: NonNullable<typeof cards>['recent_leads']['recent'] | undefined): ListRow[] =>
    (rows ?? []).map((r) => ({ id: r.id, title: r.contact_name, detail: join(r.contact_phone, r.assignee_name, formatDate(r.created_at)), to: contactLink(r.lead_id) }))

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader title="Business Overview" subtitle="Everything happening across your business." backTo="/admin" />
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-10 pt-4 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select aria-label="Dates" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className={cn(SELECT_CLASSES, 'sm:w-60')}>
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2 sm:w-80">
              <Input type="date" aria-label="From" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <Input type="date" aria-label="To" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          )}
        </div>
        {preset === 'custom' && custom.from > custom.to && <p className="text-[12px] text-[var(--error)]">The start day is after the end day, so the default dates are shown.</p>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SummaryList
            title="Follow-ups pending"
            count={cards?.followups.pending ?? 0}
            to="/followups"
            query={summary}
            emptyText="No follow-ups in these dates."
            rows={(cards?.followups.recent ?? []).map((r) => ({ id: r.id, title: r.contact_name, detail: join(formatDate(r.scheduled_date), r.assignee_name), to: contactLink(r.lead_id), late: late(r.scheduled_date) }))}
          />
          <SummaryList
            title="Meetings upcoming"
            count={cards?.meetings.upcoming ?? 0}
            to="/meetings"
            query={summary}
            emptyText="No meetings in these dates."
            rows={(cards?.meetings.recent ?? []).map((r) => ({ id: r.id, title: r.contact_name, detail: join(formatDate(r.scheduled_at), r.assignee_name), to: `/meetings/${r.id}` }))}
          />
          <SummaryList
            title="Tasks open"
            count={cards?.tasks.open ?? 0}
            to="/tasks"
            query={summary}
            emptyText="No tasks in these dates."
            rows={(cards?.tasks.recent ?? []).map((r) => ({ id: r.id, title: r.title, detail: join(r.deadline ? `Due ${formatDate(r.deadline)}` : 'No deadline', r.assignee_name), to: `/tasks/${r.id}`, late: late(r.deadline) }))}
          />
          <SummaryList
            title="Tickets open"
            count={tickets.data?.total ?? 0}
            to="/tickets"
            query={tickets}
            emptyText="No open tickets."
            rows={(tickets.data?.items ?? []).map((t) => ({ id: t.id, title: t.subject, detail: join(`TKT-${String(t.number).padStart(4, '0')}`, t.assigned_to_name ?? 'Not assigned', formatDate(t.created_at)), to: `/tickets/${t.id}` }))}
          />
          <SummaryList
            title="Public tickets"
            count={publicTickets.data?.active ?? 0}
            to="/tickets"
            query={publicTickets}
            emptyText="No public tickets waiting."
            rows={(publicTickets.data?.latest ?? []).map((t) => ({ id: t.id, title: t.subject, detail: join(t.ticket_number, t.customer_name, t.assigned ? 'Assigned' : 'Not assigned'), to: `/tickets/${t.id}` }))}
          />
          <SummaryList
            title="Open deals"
            count={cards?.deals.open ?? 0}
            to="/deals"
            query={summary}
            emptyText="No deals in these dates."
            rows={(cards?.deals.recent ?? []).map((r) => ({ id: r.id, title: r.deal_name, detail: join(r.contact_name, r.status, r.assignee_name), right: rupees(r.amount), to: contactLink(r.lead_id) }))}
          />
          <SummaryList title="Recent leads" count={cards?.recent_leads.total ?? 0} to="/contacts" query={summary} emptyText="No new leads in these dates." rows={leadRows(cards?.recent_leads.recent)} />
          <SummaryList title="Untouched leads" count={cards?.untouched_leads.total ?? 0} to="/contacts" query={summary} emptyText="No untouched leads." rows={leadRows(cards?.untouched_leads.recent)} />
          <SummaryList
            title="Payments this month"
            count={rupees(cards?.payments.month_total ?? 0)}
            to="/payments"
            query={summary}
            emptyText="No payments this month."
            rows={(cards?.payments.recent ?? []).map((r) => ({
              id: r.id,
              title: r.contact_name,
              detail: join(formatDate(r.payment_date), r.kind === 'refund' ? 'Refund' : r.mop, r.assignee_name),
              right: `${r.kind === 'refund' ? '−' : ''}${rupees(r.amount)}`,
              to: contactLink(r.lead_id),
            }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <TargetAchievedWidget />
          <SubscriberGrowthWidget />
        </div>
      </div>
    </div>
  )
}
