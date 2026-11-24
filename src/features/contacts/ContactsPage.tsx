import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CheckSquare, Filter, MailPlus, Plus, Tag, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useAuthStore } from '@/store/useAuthStore'
import { LeadWhatsAppButtons } from '@/components/LeadWhatsAppButtons'
import { useLabels, useLeadStatuses, useLeadsPage, useMyLeadCampaigns, useMyOpenFollowupsByContact } from '@/api/queries'
import { fetchLeadsPage, type CrmFollowup, type CrmLead } from '@/api/crmApi'
import { formatDate, formatTime } from '@/lib/followupFormat'
import { NO_DATE_RANGE } from '@/features/followups/followupDateFilter'
import { ContactFilterPanel } from './ContactFilterPanel'
import {
  CONTACT_TABS,
  FOLLOWUP_CHOICES,
  NO_CONTACT_FILTERS,
  activeFilterCount,
  describeAdded,
  hasFollowupTab,
  tabQuery,
  toLeadFilters,
  type ContactPanelFilters,
  type ContactsTab,
} from './contactFilters'
import { useToast } from '@/components/ui/useToast'
import { BulkEmailDialog } from './BulkEmailDialog'
import { AddNewLeadDialog } from './AddNewLeadDialog'

const MAX_BULK_SELECT = 500

const TAB_HINTS: Record<ContactsTab, string> = {
  all: "Your contacts plus unassigned ones. Other executives' contacts are not shown.",
  unassigned: 'Contacts nobody owns yet. Call or assign one to make it yours.',
  followup_today: 'Contacts with a follow-up due today — call these first.',
  overdue: 'Contacts whose follow-up date has passed and is not done yet.',
  meeting_today: 'Contacts with a meeting today.',
}

const TAB_EMPTY: Record<ContactsTab, string> = {
  all: 'No contacts yet.',
  unassigned: 'No unassigned leads right now. New ones will show up here.',
  followup_today: 'No follow-ups due today.',
  overdue: 'Nothing overdue. 🎉',
  meeting_today: 'No meetings today.',
}

// The card's follow-up line: "Follow-up today 4:00 PM" or, once the day has passed, red "Overdue since 19/10/2026".
function followupLine(f: CrmFollowup): { text: string; overdue: boolean } {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const day = f.followup_date.slice(0, 10)
  if (day < today) return { text: `Overdue since ${formatDate(f.followup_date)}`, overdue: true }
  return { text: `Follow-up ${day === today ? 'today' : formatDate(f.followup_date)} · ${formatTime(f.followup_time)}`, overdue: false }
}

export function ContactsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [search, setSearch] = useState('')
  const [addLeadOpen, setAddLeadOpen] = useState(false)
  // Leads ticked for a bulk email; kept while scrolling and across tabs/searches.
  const [selected, setSelected] = useState<Map<string, CrmLead>>(new Map())
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)
  const { show } = useToast()
  // "Unassigned" = leads nobody has taken yet (e.g. new Facebook/WhatsApp leads); first to call or assign gets it.
  const [view, setView] = useState<ContactsTab>('all')
  // Staff with admin power see every contact in the business on every tab, not just their own.
  const allStaff = useAuthStore((st) => st.isAdmin)
  const [panel, setPanel] = useState<ContactPanelFilters>(NO_CONTACT_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const filters = toLeadFilters(panel, view)
  const unassigned = tabQuery(view).unassigned
  const filterCount = activeFilterCount(panel)
  // Every tab's total under the current search + filters: one tiny request each.
  const { data: counts } = useQuery({
    queryKey: ['my-leads', 'tab-counts', userId, allStaff, search, panel],
    queryFn: async () => {
      const totals = await Promise.all(
        CONTACT_TABS.map(async (t) => (await fetchLeadsPage({ staffId: userId, allStaff, page: 1, perPage: 1, search, unassigned: tabQuery(t.value).unassigned, filters: toLeadFilters(panel, t.value) })).total),
      )
      return Object.fromEntries(CONTACT_TABS.map((t, i) => [t.value, totals[i]])) as Record<ContactsTab, number>
    },
    enabled: Boolean(userId),
  })
  const { data: openFollowups } = useMyOpenFollowupsByContact(userId)
  const {
    items: contacts,
    total: matchCount,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useLeadsPage({ staffId: userId, search, unassigned, filters, allStaff })

  // Switching tabs returns to that tab's normal first page, not a leftover search.
  function switchView(next: ContactsTab) {
    setView(next)
    setSearch('')
  }

  const { data: statuses = [] } = useLeadStatuses()
  const { data: pipelines = [] } = useMyLeadCampaigns()
  const { data: labels = [] } = useLabels()
  const nameOf = (list: { id: string }[], id: string, key: string) =>
    id === 'none' ? 'None' : ((list.find((x) => x.id === id) as Record<string, string> | undefined)?.[key] ?? '…')
  const chips: { key: string; label: string; clear: Partial<ContactPanelFilters> }[] = [
    ...(panel.followup && !hasFollowupTab(view)
      ? [{ key: 'followup', label: `Follow-up: ${FOLLOWUP_CHOICES.find((c) => c.value === panel.followup)?.label}`, clear: { followup: '' as const } }]
      : []),
    ...(panel.leadStatusId ? [{ key: 'status', label: `Status: ${nameOf(statuses, panel.leadStatusId, 'lead_status')}`, clear: { leadStatusId: '' } }] : []),
    ...(panel.campaignId ? [{ key: 'pipeline', label: `Pipeline: ${nameOf(pipelines, panel.campaignId, 'name')}`, clear: { campaignId: '' } }] : []),
    ...(panel.labelId ? [{ key: 'label', label: `Label: ${nameOf(labels, panel.labelId, 'name')}`, clear: { labelId: '' } }] : []),
    ...(panel.added.from || panel.added.to ? [{ key: 'added', label: describeAdded(panel.added), clear: { added: NO_DATE_RANGE } }] : []),
  ]

  // Selects every contact on the current tab/search, not just the ones scrolled into view, up to the bulk-email cap.
  async function selectAll() {
    setSelectingAll(true)
    try {
      const all: CrmLead[] = []
      for (let page = 1; all.length < MAX_BULK_SELECT; page++) {
        const result = await fetchLeadsPage({ staffId: userId, allStaff, page, search, unassigned, filters, perPage: 100 })
        all.push(...result.items)
        if (page >= result.totalPages) break
      }
      const picked = all.slice(0, MAX_BULK_SELECT)
      setSelected(new Map(picked.map((l) => [l.id, l])))
      if (all.length > MAX_BULK_SELECT) show({ title: `Selected the first ${MAX_BULK_SELECT} — a bulk email is limited to ${MAX_BULK_SELECT} recipients` })
    } catch (err) {
      show({ title: err instanceof Error ? err.message : 'Could not select all contacts', tone: 'error' })
    } finally {
      setSelectingAll(false)
    }
  }

  function toggleLead(lead: CrmLead) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(lead.id)) next.delete(lead.id)
      else next.set(lead.id, lead)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Contacts"
        subtitle={allStaff ? "Every contact in the business — tap one to see its history." : "Your contacts plus unassigned ones — tap one to see its history."}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkEmailOpen(true)}>
              <MailPlus size={14} />
              Bulk email
            </Button>
            <Button size="sm" onClick={() => setAddLeadOpen(true)}>
              <Plus size={14} />
              Add New Lead
            </Button>
          </div>
        }
      />
      {addLeadOpen && <AddNewLeadDialog onClose={() => setAddLeadOpen(false)} />}
      <BulkEmailDialog
        open={bulkEmailOpen}
        onClose={() => setBulkEmailOpen(false)}
        selectedLeads={[...selected.values()]}
        onQueued={() => setSelected(new Map())}
      />
      <div className="space-y-4 p-4">
        {/* Wraps on a phone so every tab stays visible. */}
        <div role="tablist" className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
          {CONTACT_TABS.map(({ value: v, label }) => {
            const n = counts?.[v]
            // Unassigned and Overdue get a coloured count when there are any; the rest a plain one.
            const loud = n !== undefined && n > 0 && (v === 'unassigned' || v === 'overdue')
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => switchView(v)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium sm:px-3 sm:text-[13px] ${
                  view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {label}
                {n !== undefined && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                      loud
                        ? v === 'overdue'
                          ? 'bg-[var(--error)] text-white'
                          : 'bg-[var(--warning)] text-white'
                        : view === v
                          ? 'bg-white/25 text-white'
                          : 'bg-[var(--surface-hover)] text-[var(--text-h)]'
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">{allStaff && view === 'all' ? 'All contacts in the business (you have admin access).' : TAB_HINTS[view]}</p>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
          </div>
          <Button
            variant="outline"
            onClick={() => setFilterOpen((o) => !o)}
            aria-expanded={filterOpen}
            aria-label="Filter contacts"
            className="relative h-10 shrink-0 gap-1.5"
          >
            <Filter size={15} />
            <span className="max-sm:hidden">Filter</span>
            {filterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[var(--error)] px-1 text-center text-[10px] font-semibold leading-4 text-white">
                {filterCount}
              </span>
            )}
          </Button>
        </div>
        {filterOpen && <ContactFilterPanel value={panel} onChange={setPanel} showFollowup={!hasFollowupTab(view)} />}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-border)] bg-[var(--accent-bg)] py-1 pl-3 pr-1.5 text-[12px] font-medium text-[var(--accent-strong)]"
              >
                {c.label}
                <button type="button" aria-label={`Clear ${c.key} filter`} onClick={() => setPanel((p) => ({ ...p, ...c.clear }))} className="rounded-full p-0.5 hover:bg-[var(--surface-hover)]">
                  <X size={13} />
                </button>
              </span>
            ))}
            {chips.length > 1 && (
              <button type="button" onClick={() => setPanel(NO_CONTACT_FILTERS)} className="px-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-h)]">
                Clear all
              </button>
            )}
          </div>
        )}
        {search && !isLoading && (
          <p className="text-[12px] text-[var(--text-muted)]">
            {matchCount} {matchCount === 1 ? 'result' : 'results'} for “{search}”
          </p>
        )}

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] px-3 py-2">
            <span className="text-[12.5px] font-medium text-[var(--accent-strong)]">
              {selected.size} contact{selected.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelected(new Map())}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setBulkEmailOpen(true)}>
                <MailPlus size={14} />
                Send email
              </Button>
            </div>
          </div>
        )}

        {contacts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void selectAll()} disabled={selectingAll}>
              <CheckSquare size={14} />
              {selectingAll ? 'Selecting…' : `Select all ${Math.min(matchCount, MAX_BULK_SELECT)}`}
            </Button>
          </div>
        )}

        {isLoading ? (
          <PageLoader />
        ) : contacts.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search ? `No results for “${search}”.` : chips.length > 0 ? 'No contacts match these filters.' : TAB_EMPTY[view]}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((lead) => (
              // A div, not a <button>: the WhatsApp links inside can't be nested in one.
              <div
                key={lead.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/contacts/${lead.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/contacts/${lead.id}`)
                }}
                className="cursor-pointer rounded-xl border border-[var(--border)] p-3.5 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleLead(lead)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={`Select ${lead.contact_name ?? 'contact'}`}
                    className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <Avatar name={lead.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <LeadWhatsAppButtons
                      contactId={lead.contact_id}
                      phone={lead.contact_phone}
                      countryCode={lead.contact_country_code}
                      ownerStaffId={lead.assign_to_staff_id}
                    />
                  </div>
                </div>
                {(() => {
                  // Built from your own follow-ups, so it would be misleading on other staff's contacts: hidden for admins.
                  const fu = allStaff ? undefined : openFollowups?.get(lead.contact_id)
                  if (!fu) return null
                  const line = followupLine(fu)
                  return (
                    <p className={`mt-2 flex items-center gap-1.5 font-mono-num text-[12px] ${line.overdue ? 'font-semibold text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                      <CalendarClock size={12} className="shrink-0" />
                      {line.text}
                    </p>
                  )
                })()}
                {(lead.lead_status || lead.lead_campaigns.length > 0 || !lead.assign_to_staff_id || (lead.labels?.length ?? 0) > 0) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {!lead.assign_to_staff_id && <Badge tone="warning">Unassigned</Badge>}
                    {lead.lead_status && <Badge tone="accent">{lead.lead_status}</Badge>}
                    {lead.lead_campaigns.map((campaign) => (
                      <Badge key={campaign.id} tone="neutral">
                        Pipeline: {campaign.name}
                      </Badge>
                    ))}
                    {lead.labels?.map((l) => (
                      <Badge key={l.id} tone="neutral">
                        <Tag size={10} className="mr-0.5 inline" />
                        {l.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
