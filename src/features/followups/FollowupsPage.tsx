import { PageLoader } from '@/components/ui/Spinner'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Check, CheckCircle2, Clock, Filter, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOLLOWUP_DATE_PRESETS, NO_DATE_RANGE, describeDateRange, presetRange, type FollowupDateRange } from './followupDateFilter'
import { FollowupWhenPicker, initialWhen, resolveWhen, whenIsValid, type When } from './FollowupWhenPicker'
import { CompleteFollowupDialog, RescheduleFollowupDialog } from './FollowupDialogs'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { RaisedBadge } from '@/components/shared/RaisePriority'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { useCreateFollowup, useFollowupTabCounts, useMyFollowupsTabPage, useStaffList } from '@/api/queries'
import { staffName } from '@/features/meetings/meetingUi'
import type { CrmContact, CrmFollowup, FollowupTab } from '@/api/crmApi'
import { STATUS_LABEL, STATUS_TONE, formatDate, formatTime } from '@/lib/followupFormat'

export { STATUS_LABEL, STATUS_TONE, formatDate, formatTime }

const TABS: { value: FollowupTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done', label: 'Done' },
]

const SUBTITLES: Record<FollowupTab, string> = {
  all: 'Every follow-up — open ones soonest first.',
  overdue: 'Past their due date and not done yet — oldest first.',
  today: 'Due today and not done yet.',
  upcoming: 'Due after today — soonest first.',
  done: 'Completed follow-ups — most recent first.',
}

const EMPTY: Record<FollowupTab, string> = {
  all: 'No follow-ups yet.',
  overdue: 'Nothing overdue. 🎉',
  today: 'Nothing due today.',
  upcoming: 'No upcoming follow-ups.',
  done: 'No completed follow-ups yet.',
}

// The stat cards: tapping one opens that tab.
const CARDS: { value: FollowupTab; label: string; icon: ReactNode; chip: string }[] = [
  { value: 'overdue', label: 'Overdue', icon: <AlertTriangle size={16} />, chip: 'bg-[var(--error-bg)] text-[var(--error)]' },
  { value: 'today', label: 'Due today', icon: <CalendarClock size={16} />, chip: 'bg-[var(--accent-bg)] text-[var(--accent-strong)]' },
  { value: 'upcoming', label: 'Upcoming', icon: <Clock size={16} />, chip: 'bg-[var(--surface-hover)] text-[var(--text)]' },
  { value: 'done', label: 'Done', icon: <CheckCircle2 size={16} />, chip: 'bg-[var(--success-bg)] text-[var(--success)]' },
]

// followup_date is a date-only IST value; open and before today's IST day = overdue.
function isOverdue(f: { followup_date: string; followup_status: string }): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  return f.followup_status !== '2' && f.followup_date.slice(0, 10) < today
}

export function FollowupsPage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  // Admins and managers see everyone's follow-ups; only admins may complete / reschedule someone else's (server rule).
  const allStaff = useAuthStore((st) => st.seesAll)
  const isAdmin = useAuthStore((st) => st.isAdmin)
  // Opens on Today, matching the Home tile's "N today".
  const [tab, setTab] = useState<FollowupTab>('today')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<FollowupDateRange>(NO_DATE_RANGE)
  const [filterOpen, setFilterOpen] = useState(false)
  const filters = { search: search || undefined, dateFrom: dateRange.from || undefined, dateTo: dateRange.to || undefined }
  const dateActive = Boolean(dateRange.from || dateRange.to)
  const { items: followups, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMyFollowupsTabPage(userId, tab, filters, allStaff)
  const { data: counts } = useFollowupTabCounts(userId, filters, allStaff)
  const { data: staff = [] } = useStaffList()
  const createFollowup = useCreateFollowup()
  const [formOpen, setFormOpen] = useState(false)
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [when, setWhen] = useState<When>(initialWhen)
  const [note, setNote] = useState('')
  // The follow-up a Complete / Reschedule dialog is open for.
  const [completing, setCompleting] = useState<CrmFollowup | null>(null)
  const [rescheduling, setRescheduling] = useState<CrmFollowup | null>(null)
  const canCreate = Boolean(contact) && whenIsValid(when)

  function submit() {
    if (!contact || !canCreate) return
    // A 1 / 2 / 4 hr button is relative to now, so it's worked out at submit time.
    const { date, time } = resolveWhen(when)
    // Executives always assign follow-ups to themselves.
    createFollowup.mutate(
      { contactId: contact.id, assignToStaffId: userId, followupDate: date, followupTime: time, note: note.trim() || undefined },
      {
        onSuccess: () => {
          show({ title: 'Follow-up scheduled', tone: 'success' })
          setContact(null)
          setWhen(initialWhen())
          setNote('')
          setFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to schedule follow-up', tone: 'error' }),
      },
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Follow-ups"
        subtitle={allStaff ? `Everyone's follow-ups. ${SUBTITLES[tab]}` : SUBTITLES[tab]}
        action={
          <Button size="sm" onClick={() => setFormOpen((v) => !v)} className="gap-1.5">
            {formOpen ? <X size={14} /> : <Plus size={14} />}
            {formOpen ? 'Close' : 'Create'}
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        {formOpen && (
          <div className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <Field label="Contact">
              <ContactPicker value={contact} onChange={setContact} />
            </Field>
            <FollowupWhenPicker value={when} onChange={setWhen} />
            <Field label="Discussion" hint="Optional — what was discussed, or what to cover">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What was discussed, or what to cover in this follow-up" />
            </Field>
            <Button className="w-full justify-center" onClick={submit} disabled={!canCreate || createFollowup.isPending}>
              {createFollowup.isPending ? 'Saving…' : 'Create Follow-up'}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {CARDS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={tab === c.value}
              onClick={() => setTab(c.value)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]',
                tab === c.value ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)]',
              )}
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', c.chip)}>{c.icon}</span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-[var(--text-muted)]">{c.label}</span>
                <span className="block font-display text-[20px] font-semibold leading-tight tabular-nums text-[var(--text-h)]">{counts ? counts[c.value] : '–'}</span>
              </span>
            </button>
          ))}
        </div>
        {/* Wraps on a phone so every tab stays visible. */}
        <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={
                tab === t.value
                  ? 'flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--ink)] sm:px-3'
                  : 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] sm:px-3'
              }
            >
              {t.label}
              {counts && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] font-semibold leading-4 tabular-nums',
                    t.value === 'overdue' && counts.overdue > 0 ? 'bg-[var(--error)] text-white' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]',
                  )}
                >
                  {counts[t.value]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
          </div>
          <Button
            variant="outline"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            aria-label="Filter by due date"
            className="relative h-10 shrink-0 gap-1.5"
          >
            <Filter size={15} />
            <span className="max-sm:hidden">Filter</span>
            {dateActive && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--error)]" />}
          </Button>
        </div>
        {filterOpen && (
          <div className="space-y-2.5 rounded-xl border border-[var(--border)] p-3">
            <p className="text-[12px] font-medium text-[var(--text-muted)]">Follow-up date</p>
            <div className="flex flex-wrap gap-1.5">
              {FOLLOWUP_DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={dateRange.preset === p.value}
                  // Tapping the selected chip again clears the filter.
                  onClick={() => setDateRange((cur) => (cur.preset === p.value ? NO_DATE_RANGE : presetRange(p.value, cur)))}
                  className={cn(
                    'h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                    dateRange.preset === p.value
                      ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {dateRange.preset === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label="From"
                  value={dateRange.from}
                  max={dateRange.to || undefined}
                  onChange={(e) => setDateRange((cur) => ({ ...cur, from: e.target.value }))}
                  className="min-w-0 flex-1"
                />
                <span className="text-[12.5px] text-[var(--text-muted)]">to</span>
                <Input
                  type="date"
                  aria-label="To"
                  value={dateRange.to}
                  min={dateRange.from || undefined}
                  onChange={(e) => setDateRange((cur) => ({ ...cur, to: e.target.value }))}
                  className="min-w-0 flex-1"
                />
              </div>
            )}
          </div>
        )}
        {dateActive && (
          <div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-border)] bg-[var(--accent-bg)] py-1 pl-3 pr-1.5 text-[12px] font-medium text-[var(--accent-strong)]">
              {describeDateRange(dateRange)}
              <button type="button" aria-label="Clear the date filter" onClick={() => setDateRange(NO_DATE_RANGE)} className="rounded-full p-0.5 hover:bg-[var(--surface-hover)]">
                <X size={13} />
              </button>
            </span>
          </div>
        )}
        {search && !isLoading && (
          <p className="text-[12px] text-[var(--text-muted)]">
            {total} {total === 1 ? 'result' : 'results'} for “{search}”
          </p>
        )}
        {isLoading ? (
          <PageLoader />
        ) : followups.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search ? `No results for “${search}”.` : dateActive ? 'No follow-ups in this date range.' : EMPTY[tab]}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followups.map((f) => {
              const overdue = isOverdue(f)
              const isDone = f.followup_status === '2'
              const canAct = !isDone && (isAdmin || !f.assign_to_staff_id || f.assign_to_staff_id === userId)
              return (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/followups/${f.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/followups/${f.id}`)
                }}
                className={`cursor-pointer rounded-xl border p-3.5 text-left hover:bg-[var(--surface-hover)] ${overdue ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={f.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{f.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{f.contact_phone ?? '—'}</p>
                    {allStaff && f.assign_to_staff_id && (
                      <p className="truncate text-[11.5px] text-[var(--text-muted)]">
                        Assigned to <span className="font-medium text-[var(--text-h)]">{f.assign_to_staff_id === userId ? 'You' : staffName(staff, f.assign_to_staff_id)}</span>
                      </p>
                    )}
                  </div>
                </div>
                <p
                  className={`mt-2.5 font-mono-num text-[12px] ${overdue ? 'font-semibold text-[var(--error)]' : 'text-[var(--text-muted)]'}`}
                >
                  Due {formatDate(f.followup_date)} · {formatTime(f.followup_time)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {f.raised ? <RaisedBadge raised={f.raised} /> : overdue ? <Badge tone="error">Overdue</Badge> : <Badge tone={STATUS_TONE[f.followup_status]}>{STATUS_LABEL[f.followup_status]}</Badge>}
                  {canAct && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label="Reschedule"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRescheduling(f)
                        }}
                      >
                        <CalendarClock size={13} /> <span className="max-[380px]:hidden">Reschedule</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCompleting(f)
                        }}
                      >
                        <Check size={13} /> Complete
                      </Button>
                    </div>
                  )}
                </div>
                {isDone && f.note && (
                  <p className="mt-2 rounded-lg bg-[var(--surface-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text-h)]">{f.note}</p>
                )}
              </div>
              )
            })}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
      <CompleteFollowupDialog followup={completing} onClose={() => setCompleting(null)} />
      <RescheduleFollowupDialog followup={rescheduling} onClose={() => setRescheduling(null)} />
    </div>
  )
}
