import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CheckSquare, Filter, MailPlus, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { SwipeRow } from '@/components/ui/SwipeRow'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useAuthStore } from '@/store/useAuthStore'
import { useActiveProducts, useContactGroups, useLabels, useLeadFlags, useLeadStageTypes, useLeadStatuses, useLeadsPage, useMyLeadCampaigns, useMyOpenFollowupsByContact, useStaffList } from '@/api/queries'
import { fetchLeadsPage, type CrmFollowup, type CrmLead } from '@/api/crmApi'
import { formatDate, formatTime } from '@/lib/followupFormat'
import { CampaignLeadFilterDialog } from '@/features/campaigns/CampaignLeadFilterDialog'
import {
  DATE_OPTIONS,
  FOLLOWUP_OPTIONS,
  MEETING_OPTIONS,
  NO_LEAD_FILTERS,
  UNASSIGNED,
  activeFilterCount,
  type CampaignLeadFilters,
} from '@/features/campaigns/campaignLeadFilters'
import { CONTACT_TABS, contactsQuery, type ContactsTab } from './contactFilters'
import { useToast } from '@/components/ui/useToast'
import { BulkEmailDialog } from './BulkEmailDialog'
import { AddNewLeadDialog } from './AddNewLeadDialog'
import { LeadCard } from './LeadCard'

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
  const isAdmin = useAuthStore((st) => st.isAdmin)
  // The same Filters popup as a pipeline's leads list, plus Pipeline.
  const [panel, setPanel] = useState<CampaignLeadFilters>(NO_LEAD_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const { staffId, allStaff, unassigned, filters } = contactsQuery(panel, view, userId, isAdmin)
  const filterCount = activeFilterCount(panel)
  // Every tab's total under the current search + filters: one tiny request each.
  const { data: counts } = useQuery({
    queryKey: ['my-leads', 'tab-counts', userId, isAdmin, search, panel],
    queryFn: async () => {
      const totals = await Promise.all(
        CONTACT_TABS.map(async (t) => (await fetchLeadsPage({ ...contactsQuery(panel, t.value, userId, isAdmin), page: 1, perPage: 1, search })).total),
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
  } = useLeadsPage({ staffId, search, unassigned, filters, allStaff })

  // Switching tabs returns to that tab's normal first page, not a leftover search.
  function switchView(next: ContactsTab) {
    setView(next)
    setSearch('')
  }

  const { data: statuses = [] } = useLeadStatuses()
  const { data: stageTypes = [] } = useLeadStageTypes()
  const { data: pipelines = [] } = useMyLeadCampaigns()
  const { data: labels = [] } = useLabels()
  const { data: groups = [] } = useContactGroups()
  const { data: products = [] } = useActiveProducts()
  const { data: flags = [] } = useLeadFlags()
  const { data: staff = [] } = useStaffList()
  const nameOf = (list: { id: string }[], id: string, key: string) =>
    id === 'none' ? 'None' : ((list.find((x) => x.id === id) as Record<string, string> | undefined)?.[key] ?? '…')
  const dmy = (v: string) => v.split('-').reverse().join('/')
  const addedText =
    panel.datePreset === 'custom'
      ? [panel.from && dmy(panel.from), panel.to && dmy(panel.to)].filter(Boolean).join(' – ')
      : DATE_OPTIONS.find((o) => o.value === panel.datePreset)?.label
  const staffMember = staff.find((x) => x.user_id === panel.staffId)
  const userText = panel.staffId === UNASSIGNED ? 'Unassigned' : staffMember ? [staffMember.first_name, staffMember.last_name].filter(Boolean).join(' ') || 'Staff' : '…'
  // One chip per filter that is on; its ✕ clears just that filter.
  const chips: { key: string; label: string; clear: Partial<CampaignLeadFilters> }[] = [
    ...(panel.datePreset ? [{ key: 'date', label: `Added: ${addedText}`, clear: { datePreset: '' as const, from: '', to: '' } }] : []),
    ...(panel.staffId ? [{ key: 'user', label: `User: ${userText}`, clear: { staffId: '' } }] : []),
    ...(panel.campaignId ? [{ key: 'pipeline', label: `Pipeline: ${nameOf(pipelines, panel.campaignId, 'name')}`, clear: { campaignId: '' } }] : []),
    ...(panel.stageId ? [{ key: 'stage', label: `Stage: ${nameOf(stageTypes, panel.stageId, 'lead_stage')}`, clear: { stageId: '', statusId: '' } }] : []),
    ...(panel.statusId ? [{ key: 'status', label: `Status: ${nameOf(statuses, panel.statusId, 'lead_status')}`, clear: { statusId: '' } }] : []),
    ...(panel.labelId ? [{ key: 'label', label: `Label: ${nameOf(labels, panel.labelId, 'name')}`, clear: { labelId: '' } }] : []),
    ...(panel.groupId ? [{ key: 'group', label: `Group: ${nameOf(groups, panel.groupId, 'name')}`, clear: { groupId: '' } }] : []),
    ...(panel.productId ? [{ key: 'product', label: `Product: ${nameOf(products, panel.productId, 'name')}`, clear: { productId: '' } }] : []),
    ...(panel.flagId ? [{ key: 'flag', label: `Call flag: ${nameOf(flags, panel.flagId, 'name')}`, clear: { flagId: '' } }] : []),
    ...(panel.followup ? [{ key: 'followup', label: `Follow-up: ${FOLLOWUP_OPTIONS.find((o) => o.value === panel.followup)?.label}`, clear: { followup: '' as const } }] : []),
    ...(panel.meeting ? [{ key: 'meeting', label: `Meeting: ${MEETING_OPTIONS.find((o) => o.value === panel.meeting)?.label}`, clear: { meeting: '' as const } }] : []),
  ]

  // Selects every contact on the current tab/search, not just the ones scrolled into view, up to the bulk-email cap.
  async function selectAll() {
    setSelectingAll(true)
    try {
      const all: CrmLead[] = []
      for (let page = 1; all.length < MAX_BULK_SELECT; page++) {
        const result = await fetchLeadsPage({ staffId, allStaff, page, search, unassigned, filters, perPage: 100 })
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
        subtitle={isAdmin ? "Every contact in the business — tap one to see its history." : "Your contacts plus unassigned ones — tap one to see its history."}
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
        {/* One row; on a phone it swipes sideways — fade + arrows show there's more. */}
        <SwipeRow activeKey={view} ariaLabel="Contact views" className="flex w-fit max-w-full gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
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
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] font-medium sm:px-2.5 sm:text-[12px] ${
                  view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {label}
                {n !== undefined && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
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
        </SwipeRow>
        <p className="text-[11px] text-[var(--text-muted)]">{isAdmin && view === 'all' ? 'All contacts in the business (you have admin access).' : TAB_HINTS[view]}</p>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
          </div>
          <Button
            variant="outline"
            onClick={() => setFilterOpen(true)}
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
        <CampaignLeadFilterDialog
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          value={panel}
          onApply={setPanel}
          showStaff={isAdmin}
          pipelines={pipelines}
          applyLabel="Show contacts"
        />
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
              <button type="button" onClick={() => setPanel(NO_LEAD_FILTERS)} className="px-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-h)]">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onOpen={() => navigate(`/contacts/${lead.id}`)} selection={{ checked: selected.has(lead.id), onToggle: () => toggleLead(lead) }}>
                {(() => {
                  // Built from your own follow-ups, so it would be misleading on other staff's contacts: hidden for admins.
                  const fu = isAdmin ? undefined : openFollowups?.get(lead.contact_id)
                  if (!fu) return null
                  const line = followupLine(fu)
                  return (
                    <p className={`flex items-center gap-1.5 font-mono-num text-[12px] ${line.overdue ? 'font-semibold text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                      <CalendarClock size={12} className="shrink-0" />
                      {line.text}
                    </p>
                  )
                })()}
              </LeadCard>
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
