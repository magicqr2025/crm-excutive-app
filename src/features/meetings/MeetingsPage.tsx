import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useMeetingsPage, useCreateMeeting } from '@/api/queries'
import { useAuthStore } from '@/store/useAuthStore'
import type { CrmContact, CrmMeeting } from '@/api/crmApi'
import { MeetingCard } from './MeetingCard'
import { isOverdue } from './meetingUi'

export function MeetingsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { items: meetings, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMeetingsPage(search)
  const createMeeting = useCreateMeeting()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [meetingSummary, setMeetingSummary] = useState('')
  const [meetingPricing, setMeetingPricing] = useState('')

  const overdueCount = meetings.filter((m) => isOverdue(m)).length

  function resetForm() {
    setContact(null)
    setMeetingTime('')
    setMeetingType('')
    setMeetingLink('')
    setMeetingSummary('')
    setMeetingPricing('')
  }

  function submit() {
    if (!contact || !meetingTime) return
    createMeeting.mutate(
      {
        contactId: contact.id,
        meetingTime,
        meetingType: meetingType.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        meetingSummary: meetingSummary.trim() || undefined,
        pricing: meetingPricing ? Number(meetingPricing) : undefined,
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

  function openMeeting(meeting: CrmMeeting) {
    // Contact pages are keyed by lead id; the API gives each meeting its contact's latest lead.
    const leadId = meeting.lead_id
    if (!leadId) {
      show({ title: "This meeting's contact isn't in your contacts", tone: 'error' })
      return
    }
    navigate(`/contacts/${leadId}?tab=meeting`)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Meetings"
        subtitle={`${total} meeting${total === 1 ? '' : 's'} on record${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
        action={
          <Button size="sm" onClick={() => setFormOpen((v) => !v)} className="gap-1.5">
            {formOpen ? <X size={14} /> : <Plus size={14} />}
            {formOpen ? 'Close' : 'Schedule'}
          </Button>
        }
      />
      <div className="p-4">
        {formOpen && (
          <div className="mb-4 space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <Field label="Contact">
              <ContactPicker value={contact} onChange={setContact} />
            </Field>
            <Field label="Date & time">
              <Input type="datetime-local" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
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
            <Button className="w-full justify-center" onClick={submit} disabled={!contact || !meetingTime || createMeeting.isPending}>
              {createMeeting.isPending ? 'Saving…' : 'Schedule Meeting'}
            </Button>
          </div>
        )}

        <div className="mb-4 space-y-2">
          <SearchBox value={search} onSubmit={setSearch} placeholder="Search by contact or type…" />
          {search && !isLoading && (
            <p className="text-[12px] text-[var(--text-muted)]">
              {total} {total === 1 ? 'result' : 'results'} for “{search}”
            </p>
          )}
        </div>

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No meetings yet.'}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                userId={userId}
                isAdmin={false}
                showContact
                onOpen={() => openMeeting(meeting)}
              />
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
