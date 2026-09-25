import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useAuthStore } from '@/store/useAuthStore'
import { useLeadsPage, useLeadCount } from '@/api/queries'
import { AddNewLeadDialog } from './AddNewLeadDialog'

export function ContactsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [search, setSearch] = useState('')
  const [addLeadOpen, setAddLeadOpen] = useState(false)
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

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Contacts"
        subtitle="Your contacts plus unassigned ones — tap one to see its history."
        action={
          <Button size="sm" onClick={() => setAddLeadOpen(true)}>
            <Plus size={14} />
            Add New Lead
          </Button>
        }
      />
      {addLeadOpen && <AddNewLeadDialog onClose={() => setAddLeadOpen(false)} />}
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

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
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
              <button
                key={lead.id}
                type="button"
                onClick={() => navigate(`/contacts/${lead.id}`)}
                className="rounded-xl border border-[var(--border)] p-3.5 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={lead.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
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
              </button>
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
