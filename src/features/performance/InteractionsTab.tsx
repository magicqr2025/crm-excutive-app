import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarCheck, ChevronDown, Handshake, IndianRupee, PhoneCall, PhoneIncoming, UserPlus, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyInteractions, useMyPerformance } from '@/api/queries'
import type { CrmInteraction, InteractionKind, PerformancePeriod } from '@/api/crmApi'
import { formatClock } from '@/features/inbox/inboxFormat'
import { cn } from '@/lib/utils'
import { Card, Kpi, PipelineBar } from './PerformanceParts'
import { pct, rupees } from './performanceUtils'

const KIND_META: Record<InteractionKind, { icon: LucideIcon; label: string }> = {
  call: { icon: PhoneCall, label: 'Call' },
  meeting: { icon: CalendarCheck, label: 'Meeting' },
  followup: { icon: Bell, label: 'Follow-up' },
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'error' | 'neutral' }> = {
  connected: { label: 'Connected', tone: 'success' },
  not_connected: { label: 'Not connected', tone: 'neutral' },
  not_reviewed: { label: 'Not reviewed', tone: 'neutral' },
  completed: { label: 'Attended', tone: 'success' },
  scheduled: { label: 'Upcoming', tone: 'info' },
  missed: { label: 'Missed', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  done: { label: 'Done', tone: 'success' },
  pending: { label: 'Pending', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'error' },
}

const dayKey = (iso: string) => new Date(iso).toDateString()

function dayHeading(iso: string) {
  const d = new Date(iso)
  const shift = (n: number) => {
    const x = new Date()
    x.setDate(x.getDate() + n)
    return x.toDateString()
  }
  if (d.toDateString() === shift(0)) return 'Today'
  if (d.toDateString() === shift(-1)) return 'Yesterday'
  if (d.toDateString() === shift(1)) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** A day's header with its counts per kind; the day's interactions are hidden until it's opened. */
function DayGroup({ heading, rows }: { heading: string; rows: CrmInteraction[] }) {
  const [open, setOpen] = useState(false)
  const count = (kind: InteractionKind) => rows.filter((r) => r.kind === kind).length
  // Anything that needs attention that day (missed meeting, overdue follow-up).
  const flagged = rows.filter((r) => r.status === 'missed' || r.status === 'overdue').length

  return (
    <section className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn('flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]', open && 'bg-[var(--surface-hover)]')}
      >
        <ChevronDown size={15} className={cn('shrink-0 text-[var(--text-muted)] transition-transform', !open && '-rotate-90')} />
        <span className="min-w-0 flex-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-h)]">{heading}</span>
        {flagged > 0 && (
          <Badge tone="warning" className="shrink-0">
            {flagged} <span className="max-sm:hidden">{flagged === 1 ? 'needs' : 'need'} attention</span>
            <span className="sm:hidden">!</span>
          </Badge>
        )}
        <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-[var(--text-muted)]">{rows.length}</span>
        {/* Always all three, so the days line up; zeros are dimmed. On phones they drop to their own line. */}
        <span className="order-last grid basis-full grid-cols-3 items-center gap-2 pl-7">
          {(['call', 'meeting', 'followup'] as const).map((kind) => {
            const Icon = KIND_META[kind].icon
            const n = count(kind)
            return (
              <span key={kind} className={cn('flex items-center gap-1 whitespace-nowrap text-[12px] tabular-nums', n === 0 ? 'text-[var(--text-muted)] opacity-50' : 'text-[var(--text-h)]')}>
                <Icon size={12} className="shrink-0" /> {n} {KIND_META[kind].label.toLowerCase()}
                {n === 1 ? '' : 's'}
              </span>
            )
          })}
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {rows.map((item) => (
            <InteractionRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** One line per interaction: what, with whom, when, and its result. */
function InteractionRow({ item }: { item: CrmInteraction }) {
  const meta = KIND_META[item.kind]
  const status = STATUS_META[item.status] ?? { label: item.status, tone: 'neutral' as const }
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent-strong)]">
        <meta.icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-[var(--text-h)]">
          <span className="text-[var(--text-muted)]">{meta.label} · </span>
          {item.lead_id ? (
            <Link to={`/contacts/${item.lead_id}`} className="font-medium hover:text-[var(--accent-strong)] hover:underline">
              {item.contact_name}
            </Link>
          ) : (
            <span className="font-medium">{item.contact_name}</span>
          )}
        </p>
        {(item.detail || item.note) && <p className="line-clamp-2 text-[11.5px] text-[var(--text-muted)]">{[item.detail, item.note].filter(Boolean).join(' · ')}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="text-[11.5px] tabular-nums text-[var(--text-muted)]">{formatClock(item.at)}</span>
      </div>
    </li>
  )
}

/** Calls, meetings and follow-ups in the period, with the headline numbers and the pipeline above them. */
export function InteractionsTab({
  period,
  periodLabel,
  onOpenSales,
}: {
  period: PerformancePeriod
  periodLabel: string
  onOpenSales: () => void
}) {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const perf = useMyPerformance(period, userId)
  const interactions = useMyInteractions(period, userId)
  const [kind, setKind] = useState<InteractionKind | 'all'>('all')
  const mine = perf.data?.mine ?? null
  const counts = interactions.data?.counts ?? { calls: 0, meetings: 0, followups: 0 }
  const items = useMemo(() => (interactions.data?.items ?? []).filter((i) => kind === 'all' || i.kind === kind), [interactions.data, kind])

  const groups = useMemo(() => {
    const out: { key: string; heading: string; rows: CrmInteraction[] }[] = []
    for (const item of items) {
      const key = dayKey(item.at)
      if (out[out.length - 1]?.key !== key) out.push({ key, heading: dayHeading(item.at), rows: [] })
      out[out.length - 1].rows.push(item)
    }
    return out
  }, [items])

  // A KPI tile filters the list to its kind (tap again for everything).
  const toggle = (next: InteractionKind) => setKind((cur) => (cur === next ? 'all' : next))

  const filters: { value: InteractionKind | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.calls + counts.meetings + counts.followups },
    { value: 'call', label: 'Calls', count: counts.calls },
    { value: 'meeting', label: 'Meetings', count: counts.meetings },
    { value: 'followup', label: 'Follow-ups', count: counts.followups },
  ]

  if (perf.isLoading) return <PageLoader />

  return (
    <div className="space-y-3">
      {mine && (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <Kpi icon={UserPlus} label="New leads" value={String(mine.leads.new_this_month)} sub={`${mine.leads.total} assigned now`} to="/contacts" />
            <Kpi
              icon={PhoneCall}
              label="Calls"
              value={String(mine.calls.total)}
              sub={`${pct(mine.calls.connected, mine.calls.total)}% connected`}
              onClick={() => toggle('call')}
              active={kind === 'call'}
            />
            <Kpi
              icon={CalendarCheck}
              label="Meetings attended"
              value={String(mine.meetings.attended)}
              sub={`${mine.meetings.upcoming} upcoming · ${mine.meetings.missed} missed`}
              onClick={() => toggle('meeting')}
              active={kind === 'meeting'}
            />
            <Kpi
              icon={Bell}
              label="Follow-ups done"
              value={String(mine.followups.done)}
              sub={mine.followups.overdue ? `${mine.followups.overdue} overdue` : `${mine.followups.pending} pending`}
              tone={mine.followups.overdue ? 'warning' : undefined}
              onClick={() => toggle('followup')}
              active={kind === 'followup'}
            />
            <Kpi icon={Handshake} label="Deals booked" value={rupees(mine.deals.booked_amount)} sub={`${mine.deals.count} deal${mine.deals.count === 1 ? '' : 's'}`} onClick={onOpenSales} />
            <Kpi
              icon={IndianRupee}
              label="Sales collected"
              value={rupees(mine.collected)}
              tone="success"
              sub={mine.target ? `${pct(mine.collected, mine.target.target_amount)}% of target` : 'No target set'}
              onClick={onOpenSales}
            />
          </div>
          <Card title="Sales pipeline" icon={Handshake}>
            <div className="px-4 py-4">
              <PipelineBar pipeline={mine.leads.pipeline} stages={perf.data?.stages ?? []} />
              <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">Your assigned leads by stage, as of today.</p>
            </div>
          </Card>
        </>
      )}

      {interactions.isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pt-1">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setKind(f.value)}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                  kind === f.value
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
                )}
              >
                {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--text-muted)]">
              <PhoneIncoming size={22} />
              <p className="text-[13px]">
                No {kind === 'all' ? 'calls, meetings or follow-ups' : `${KIND_META[kind].label.toLowerCase()}s`} in {periodLabel}.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {groups.map((g) => (
                <DayGroup key={g.key} heading={g.heading} rows={g.rows} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
