import { PageLoader } from '@/components/ui/Spinner'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Link2, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useMeetingsPage } from '@/api/queries'
import { useAuthStore } from '@/store/useAuthStore'
import type { CrmContact, MeetingView } from '@/api/crmApi'
import { MeetingCard } from './MeetingCard'
import { MeetingCreateForm } from './MeetingCreateForm'
import { MeetingStatCards, MEETING_VIEW_LABEL } from './MeetingStatCards'
import { UnclaimedBookingsPanel } from './UnclaimedBookingsPanel'
import { DEFAULT_MEETING_RANGE, allCardFor, rangeBounds, type MeetingRangeValue } from './meetingRange'
import { MeetingRangeBar } from './MeetingRangeBar'

type SourceFilter = '' | 'booking' | 'manual'

export function MeetingsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  // Which stat card is selected ('all' = no card filter), the page-wide date range and the source filter.
  const [view, setView] = useState<MeetingView>('all')
  // Default: meetings happening today, whenever they were created.
  const [range, setRange] = useState<MeetingRangeValue>(DEFAULT_MEETING_RANGE)
  const [source, setSource] = useState<SourceFilter>('')

  // "Now" splits Upcoming from Overdue; refreshed each minute so a meeting moves across while the page is open.
  const [nowIso, setNowIso] = useState(() => new Date().toISOString())
  useEffect(() => {
    const t = setInterval(() => setNowIso(new Date().toISOString()), 60_000)
    return () => clearInterval(t)
  }, [])
  // Local-day bounds: the same instants on every render within a day, so the query key stays stable.
  const bounds = rangeBounds(range)

  const {
    items: meetings,
    total,
    summary: counts,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMeetingsPage({
    search: search || undefined,
    view,
    upcomingFrom: nowIso,
    source: source || undefined,
    ...(range.basis === 'meeting' ? { dateFrom: bounds.from, dateTo: bounds.to } : { createdFrom: bounds.from, createdTo: bounds.to }),
  })
  const allCard = allCardFor(range)
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)

  const filtered = Boolean(search || source)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Meetings"
        subtitle={`${view === 'all' ? 'All' : MEETING_VIEW_LABEL[view]} meetings`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/meetings/links')} className="gap-1.5">
              <Link2 size={14} /> <span className="max-sm:hidden">Booking links</span>
            </Button>
            <Button size="sm" onClick={() => setFormOpen((v) => !v)} className="gap-1.5">
              {formOpen ? <X size={14} /> : <Plus size={14} />}
              {formOpen ? 'Close' : 'Schedule'}
            </Button>
          </div>
        }
      />
      <div className="p-4">
        <UnclaimedBookingsPanel />
        {formOpen && (
          <div className="mb-4 space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <Field label="Contact">
              <ContactPicker value={contact} onChange={setContact} />
            </Field>
            <MeetingCreateForm
              contactId={contact?.id ?? null}
              onDone={() => {
                setContact(null)
                setFormOpen(false)
              }}
            />
          </div>
        )}

        <MeetingStatCards
          view={view}
          counts={counts}
          onSelect={setView}
          allCard={allCard}
        />

        <div className="mb-4 space-y-2">
          <MeetingRangeBar value={range} onChange={setRange} />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchBox value={search} onSubmit={setSearch} placeholder="Search by contact or type…" />
            </div>
            <select
              aria-label="Source"
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              className="h-10 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-[var(--text-h)]"
            >
              <option value="">All sources</option>
              <option value="booking">Booked online</option>
              <option value="manual">Added manually</option>
            </select>
          </div>
          {search && !isLoading && (
            <p className="text-[12px] text-[var(--text-muted)]">
              {total} {total === 1 ? 'result' : 'results'} for “{search}”
            </p>
          )}
        </div>

        {isLoading ? (
          <PageLoader />
        ) : meetings.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {filtered ? 'No meetings match your search or filters.' : `No ${view === 'all' ? '' : `${MEETING_VIEW_LABEL[view].toLowerCase()} `}meetings in this range. Try a wider range.`}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} userId={userId} isAdmin={false} showContact onOpen={() => navigate(`/meetings/${meeting.id}`)} />
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
