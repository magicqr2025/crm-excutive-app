import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, MailPlus, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useAuthStore } from '@/store/useAuthStore'
import { LeadWhatsAppButtons } from '@/components/LeadWhatsAppButtons'
import { useLeadsPage, useLeadCount } from '@/api/queries'
import { fetchLeadsPage, type CrmLead } from '@/api/crmApi'
import { useToast } from '@/components/ui/useToast'
import { BulkEmailDialog } from './BulkEmailDialog'
import { AddNewLeadDialog } from './AddNewLeadDialog'

const MAX_BULK_SELECT = 500

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
  const [view, setView] = useState<'all' | 'unassigned'>('all')
  const { data: allCount = 0 } = useLeadCount(userId, false)
  const { data: unassignedCount = 0 } = useLeadCount(userId, true)
  const {
    items: contacts,
    total: matchCount,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useLeadsPage({ staffId: userId, search, unassigned: view === 'unassigned' })

  // Switching tabs returns to that tab's normal first page, not a leftover search.
  function switchView(next: 'all' | 'unassigned') {
    setView(next)
    setSearch('')
  }

  // Selects every contact on the current tab/search, not just the ones scrolled into view, up to the bulk-email cap.
  async function selectAll() {
    setSelectingAll(true)
    try {
      const all: CrmLead[] = []
      for (let page = 1; all.length < MAX_BULK_SELECT; page++) {
        const result = await fetchLeadsPage({ staffId: userId, page, search, unassigned: view === 'unassigned', perPage: 100 })
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
        subtitle="Your contacts plus unassigned ones — tap one to see its history."
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
        <div role="tablist" className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          {(['all', 'unassigned'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ${
                view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {v === 'all' ? 'All contacts' : 'Unassigned'}
              {v === 'all' && (
                <span
                  className={`rounded-full px-1.5 text-[11px] font-semibold ${
                    view === v ? 'bg-white/25 text-white' : 'bg-[var(--surface-hover)] text-[var(--text-h)]'
                  }`}
                >
                  {allCount}
                </span>
              )}
              {v === 'unassigned' && unassignedCount > 0 && (
                <span className="rounded-full bg-[var(--warning)] px-1.5 text-[11px] font-semibold text-white">{unassignedCount}</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">
          {view === 'all'
            ? `Only your contacts (${allCount - unassignedCount}) plus unassigned ones (${unassignedCount}). Other executives' contacts are not shown.`
            : 'Contacts nobody owns yet. Call or assign one to make it yours.'}
        </p>
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
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
            {search
              ? `No results for “${search}”.`
              : view === 'unassigned'
                ? 'No unassigned leads right now. New ones will show up here.'
                : 'No contacts yet.'}
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
                {(lead.lead_status || lead.lead_campaigns.length > 0 || !lead.assign_to_staff_id) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {!lead.assign_to_staff_id && <Badge tone="warning">Unassigned</Badge>}
                    {lead.lead_status && <Badge tone="accent">{lead.lead_status}</Badge>}
                    {lead.lead_campaigns.map((campaign) => (
                      <Badge key={campaign.id} tone="neutral">
                        Campaign: {campaign.name}
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
