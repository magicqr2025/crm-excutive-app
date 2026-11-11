import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Inbox, LifeBuoy, Plus, Sparkles, UserX, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { useStaffList, useTicketMasters, useTicketSummary, useTicketsPage } from '@/api/queries'
import type { Ticket, TicketPriority, TicketStatusFilter, TicketType } from '@/api/ticketsApi'
import { useCan } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import {
  SELECT_CLASS,
  TICKET_PRIORITY_LABEL,
  TICKET_PRIORITY_OPTIONS,
  TICKET_PRIORITY_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  TICKET_TYPE_LABEL,
  TICKET_TYPE_OPTIONS,
  TICKET_TYPE_TONE,
  ticketNumber,
  timeAgo,
} from './ticketUi'

const STATUS_TABS: { value: TicketStatusFilter | 'all'; label: string }[] = [
  { value: 'active', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
]

interface Filters {
  status: TicketStatusFilter | 'all'
  priority: TicketPriority | ''
  ticketType: TicketType | ''
  categoryId: string
  assigneeId: string
  age: 'new' | 'old' | ''
}

const DEFAULT_FILTERS: Filters = { status: 'active', priority: '', ticketType: '', categoryId: '', assigneeId: '', age: '' }

interface Card {
  label: string
  sub: string
  value: number | undefined
  icon: LucideIcon
  tone: string
  /** What tapping the card narrows the list to. */
  filters: Partial<Filters>
}

const sameFilters = (f: Filters, patch: Partial<Filters>) => (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).every((k) => f[k] === (patch[k] ?? DEFAULT_FILTERS[k]) || (patch[k] === undefined && k === 'status' && f.status === 'all'))

function TicketRow({ ticket: t, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const about = [t.category_name, t.product_name, t.contact_name ?? t.customer_name].filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-xl border border-[var(--border)] p-3.5 text-left hover:bg-[var(--surface-hover)]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold tabular-nums text-[var(--text-muted)]">{ticketNumber(t.number)}</span>
        <span className="shrink-0 text-[11.5px] text-[var(--text-muted)]">{timeAgo(t.created_at)}</span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[14px] font-semibold text-[var(--text-h)]">{t.subject}</p>
      {about && <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{about}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
        <Badge tone={TICKET_PRIORITY_TONE[t.priority]}>{TICKET_PRIORITY_LABEL[t.priority]}</Badge>
        <Badge tone={TICKET_TYPE_TONE[t.ticket_type]}>{TICKET_TYPE_LABEL[t.ticket_type]}</Badge>
      </div>
      <p className="mt-2 text-[12px] text-[var(--text-muted)]">
        {t.assigned_to_name ? `Assigned to ${t.assigned_to_name}` : 'Unassigned'}
        {t.raised_by_name || t.raised_via_api ? ` · Raised by ${t.raised_by_name ?? 'API'}` : ''}
      </p>
    </button>
  )
}

export function TicketsPage() {
  const navigate = useNavigate()
  const canAdd = useCan('tickets', 'add')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [search, setSearch] = useState('')

  const { data: summary, isLoading: loadingSummary } = useTicketSummary()
  const { data: categories = [] } = useTicketMasters('categories')
  const { data: staff = [] } = useStaffList()
  const { items: tickets, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useTicketsPage({
    search: search || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    priority: filters.priority || undefined,
    ticketType: filters.ticketType || undefined,
    categoryId: filters.categoryId || undefined,
    assigneeId: filters.assigneeId || undefined,
    age: filters.age || undefined,
  })

  const patch = (next: Partial<Filters>) => setFilters((f) => ({ ...f, ...next }))
  // A card narrows the list to its slice; tapping the same card again goes back to the default view.
  const pick = (card: Partial<Filters>) => setFilters(sameFilters(filters, card) ? DEFAULT_FILTERS : { ...DEFAULT_FILTERS, status: 'all', ...card })

  const cards: Card[] = [
    { label: 'Open', sub: 'Open, in progress or on hold', value: summary?.active, icon: Inbox, tone: 'bg-[var(--accent-bg)] text-[var(--accent-strong)]', filters: { status: 'active' } },
    { label: 'New', sub: `Last ${summary?.new_window_hours ?? 24} hours`, value: summary?.new_tickets, icon: Sparkles, tone: 'bg-[var(--success-bg)] text-[var(--success)]', filters: { age: 'new' } },
    { label: 'Old', sub: `Open after ${summary?.old_after_days ?? 7} days`, value: summary?.old_tickets, icon: Clock, tone: 'bg-[var(--warning-bg)] text-[var(--warning)]', filters: { age: 'old' } },
    { label: 'Unassigned', sub: 'Nobody is on it', value: summary?.unassigned, icon: UserX, tone: 'bg-[var(--error-bg)] text-[var(--error)]', filters: { assigneeId: 'unassigned', status: 'active' } },
    { label: 'Closed', sub: 'Finished', value: summary?.by_status.closed, icon: CheckCircle2, tone: 'bg-[var(--surface-hover)] text-[var(--text-muted)]', filters: { status: 'closed' } },
  ]

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Tickets"
        subtitle={`${total} ticket${total === 1 ? '' : 's'}`}
        action={
          canAdd && (
            <Button size="sm" onClick={() => navigate('/tickets/new')} className="gap-1.5">
              <Plus size={14} /> New
            </Button>
          )
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => {
            const selected = sameFilters(filters, c.filters)
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={selected}
                onClick={() => pick(c.filters)}
                className={cn('rounded-xl border bg-[var(--surface)] p-3 text-left hover:bg-[var(--surface-hover)]', selected ? 'border-[var(--accent)]' : 'border-[var(--border)]')}
              >
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', c.tone)}>
                  <c.icon size={16} />
                </span>
                <p className="mt-2 font-display text-[20px] font-semibold leading-none tabular-nums text-[var(--text-h)]">{loadingSummary ? '–' : (c.value ?? 0)}</p>
                <p className="mt-1 text-[12px] font-medium text-[var(--text-h)]">{c.label}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">{c.sub}</p>
              </button>
            )
          })}
        </div>

        {summary && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-h)]">
              <AlertTriangle size={13} className="text-[var(--text-muted)]" /> Open by priority
            </span>
            {TICKET_PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => patch({ status: 'active', priority: filters.priority === p.value ? '' : p.value })}
                className={cn('text-[12.5px] hover:underline', filters.priority === p.value ? 'font-semibold text-[var(--accent-strong)]' : 'text-[var(--text-muted)]')}
              >
                {p.label} <span className="tabular-nums text-[var(--text-h)]">{summary.active_by_priority[p.value] ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Ticket status">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={filters.status === t.value}
              onClick={() => patch({ status: t.value })}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
                filters.status === t.value
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by number, subject or customer…" />

        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Filter by type" value={filters.ticketType} onChange={(e) => patch({ ticketType: e.target.value as TicketType | '' })} className={SELECT_CLASS}>
            <option value="">All types</option>
            {TICKET_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Filter by category" value={filters.categoryId} onChange={(e) => patch({ categoryId: e.target.value })} className={SELECT_CLASS}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => patch({ priority: e.target.value as TicketPriority | '' })} className={SELECT_CLASS}>
            <option value="">All priorities</option>
            {TICKET_PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Filter by assignee" value={filters.assigneeId} onChange={(e) => patch({ assigneeId: e.target.value })} className={SELECT_CLASS}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--text-muted)]">
            <LifeBuoy size={24} />
            <p className="text-[13.5px] font-medium text-[var(--text-h)]">No tickets found</p>
            <p className="max-w-xs text-[12.5px]">{canAdd ? 'Raise a ticket to report an issue, an error, or ask for a feature.' : 'Nothing matches these filters.'}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tickets.map((t) => (
              <TicketRow key={t.id} ticket={t} onOpen={() => navigate(`/tickets/${t.id}`)} />
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
