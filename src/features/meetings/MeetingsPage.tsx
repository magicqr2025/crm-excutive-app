import { PageLoader } from '@/components/ui/Spinner'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Link2, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useMeetingsPage, useCreateMeeting } from '@/api/queries'
import { useAuthStore } from '@/store/useAuthStore'
import type { CrmContact, MeetingView } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { MeetingCard } from './MeetingCard'
import { MeetingReminderPicker } from './MeetingReminderPicker'
import { FreeTimeBooking } from './FreeTimeBooking'
import { MeetingStatCards, MEETING_VIEW_LABEL } from './MeetingStatCards'
import { UnclaimedBookingsPanel } from './UnclaimedBookingsPanel'
import type { MeetingReminder } from '@/api/crmApi'
import { CREATED_PRESETS, DEFAULT_CREATED_PRESET, createdFrom, describeCreated, type CreatedPreset } from './meetingRange'
import { LENGTH_OPTIONS, DEFAULT_LENGTH, SELECT_CLASS } from './meetingUi'

type SourceFilter = '' | 'booking' | 'manual'
// Add a meeting by picking one of your free times (books a link, emails the invite) or by typing a time.
type AddMode = 'free' | 'type'

export function MeetingsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  // Which stat card is selected ('all' = no card filter), the created-on range and the source filter.
  const [view, setView] = useState<MeetingView>('all')
  const [preset, setPreset] = useState<CreatedPreset>(DEFAULT_CREATED_PRESET)
  const [source, setSource] = useState<SourceFilter>('')

  // "Now" splits Upcoming from Overdue; refreshed each minute so a meeting moves across while the page is open.
  const [nowIso, setNowIso] = useState(() => new Date().toISOString())
  useEffect(() => {
    const t = setInterval(() => setNowIso(new Date().toISOString()), 60_000)
    return () => clearInterval(t)
  }, [])
  // Computed per range choice, not per render, so the query key stays stable.
  const [from, setFrom] = useState(() => createdFrom(DEFAULT_CREATED_PRESET))

  const {
    items: meetings,
    total,
    summary: counts,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMeetingsPage({ search: search || undefined, view, upcomingFrom: nowIso, source: source || undefined, createdFrom: from })
  const createMeeting = useCreateMeeting()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [mode, setMode] = useState<AddMode>('free')
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [length, setLength] = useState(DEFAULT_LENGTH)
  const [meetingLink, setMeetingLink] = useState('')
  const [meetingSummary, setMeetingSummary] = useState('')
  const [meetingPricing, setMeetingPricing] = useState('')
  const [reminder, setReminder] = useState<MeetingReminder | null>(null)

  function resetForm() {
    setContact(null)
    setMeetingTime('')
    setMeetingType('')
    setLength(DEFAULT_LENGTH)
    setMeetingLink('')
    setMeetingSummary('')
    setMeetingPricing('')
    setReminder(null)
  }

  function submit() {
    if (!contact || !meetingTime) return
    if (reminder && !reminder.remind_24h && !reminder.remind_1h) {
      show({ title: 'Choose when to send the reminder', tone: 'error' })
      return
    }
    createMeeting.mutate(
      {
        contactId: contact.id,
        meetingTime,
        meetingType: meetingType.trim() || undefined,
        durationMinutes: length,
        meetingLink: meetingLink.trim() || undefined,
        meetingSummary: meetingSummary.trim() || undefined,
        pricing: meetingPricing ? Number(meetingPricing) : undefined,
        reminder: reminder ?? undefined,
      },
      {
        onSuccess: () => {
          show({ title: 'Meeting scheduled', tone: 'success' })
          resetForm()
          setFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to schedule meeting', tone: 'error' }),
      },
    )
  }

  const filtered = Boolean(search || source)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Meetings"
        subtitle={`${describeCreated(preset)} · ${MEETING_VIEW_LABEL[view].toLowerCase()}`}
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
            <div role="tablist" className="flex rounded-lg bg-[var(--surface-hover)] p-1">
              {(
                [
                  { value: 'free', label: 'Pick a free time' },
                  { value: 'type', label: 'Type a time' },
                ] as const
              ).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    mode === m.value ? 'bg-[var(--surface)] text-[var(--accent-strong)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === 'free' ? (
              <FreeTimeBooking
                contactId={contact?.id ?? null}
                onBooked={() => {
                  resetForm()
                  setFormOpen(false)
                }}
              />
            ) : (
              <>
            <Field label="Date & time">
              <Input type="datetime-local" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
            </Field>
            <Field label="Length" hint="A typed meeting also blocks that time on your booking link">
              <select value={length} onChange={(e) => setLength(Number(e.target.value))} className={SELECT_CLASS}>
                {LENGTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type" hint="Optional — e.g. Demo, Follow-up call">
              <Input value={meetingType} onChange={(e) => setMeetingType(e.target.value)} placeholder="Demo" />
            </Field>
            <Field label="Meeting link" hint="Optional">
              <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/…" />
            </Field>
            <Field label="Pricing" hint="Optional">
              <Input type="number" inputMode="decimal" value={meetingPricing} onChange={(e) => setMeetingPricing(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Summary" hint="Optional">
              <Textarea value={meetingSummary} onChange={(e) => setMeetingSummary(e.target.value)} rows={3} placeholder="Agenda or notes…" />
            </Field>
            <MeetingReminderPicker value={reminder} onChange={setReminder} />
            <Button className="w-full justify-center" onClick={submit} disabled={!contact || !meetingTime || createMeeting.isPending}>
              {createMeeting.isPending ? 'Saving…' : 'Schedule Meeting'}
            </Button>
              </>
            )}
          </div>
        )}

        <MeetingStatCards view={view} counts={counts} onSelect={setView} />

        <div className="mb-4 space-y-2">
          <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="Created on">
            {CREATED_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={preset === p.value}
                onClick={() => {
                  setPreset(p.value)
                  setFrom(createdFrom(p.value))
                }}
                className={cn(
                  'h-8 shrink-0 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                  preset === p.value
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
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
            {filtered ? 'No meetings match your search or filters.' : `No ${view === 'all' ? '' : `${MEETING_VIEW_LABEL[view].toLowerCase()} `}meetings ${describeCreated(preset)}. Try a wider range.`}
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
