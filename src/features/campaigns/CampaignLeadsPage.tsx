import { useMemo, useState } from 'react'
import { PageLoader } from '@/components/ui/Spinner'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Funnel, Lock, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useAuthStore } from '@/store/useAuthStore'
import { useCampaignLeadsPage, useMyLeadCampaigns, useSearchPipelines } from '@/api/queries'
import type { CampaignLeadListFilters, CampaignLeadScope } from '@/api/crmApi'
import { CampaignLeadFilterDialog } from './CampaignLeadFilterDialog'
import { NO_LEAD_FILTERS, UNASSIGNED, activeFilterCount, createdRangeFor, filtersFromParams, filtersToParams, type CampaignLeadFilters } from './campaignLeadFilters'
import { cn } from '@/lib/utils'
import { LeadWhatsAppButtons } from '@/components/LeadWhatsAppButtons'

export function CampaignLeadsPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  // Admins see every lead in the pipeline (no staff filter) and can open any of them.
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { data: campaigns = [] } = useMyLeadCampaigns()
  // The search lives in the URL (?q=) so an "Also found in" link can open another
  // pipeline with the same search already applied.
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const setSearch = (q: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  // Filters also live in the URL, so Back from a lead keeps them.
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams])
  const filterCount = activeFilterCount(filters)
  const [filterOpen, setFilterOpen] = useState(false)
  const applyFilters = (next: CampaignLeadFilters) => setSearchParams((prev) => filtersToParams(next, prev), { replace: true })
  const listFilters = useMemo<CampaignLeadListFilters>(
    () => ({
      stageId: filters.stageId || undefined,
      leadStatusId: filters.statusId || undefined,
      labelId: filters.labelId || undefined,
      groupId: filters.groupId || undefined,
      productId: filters.productId || undefined,
      flagId: filters.flagId || undefined,
      followup: filters.followup || undefined,
      meeting: filters.meeting || undefined,
      unassigned: (isAdmin && filters.staffId === UNASSIGNED) || undefined,
      ...createdRangeFor(filters),
    }),
    [filters, isAdmin],
  )
  // Admin's User filter: one staff member's leads (Unassigned is sent as its own flag).
  const adminStaffId = isAdmin && filters.staffId && filters.staffId !== UNASSIGNED ? filters.staffId : ''
  const { data: otherPipelines = [] } = useSearchPipelines(search, campaignId)
  // The list shows only the executive's own leads. A search looks across this
  // campaign (and only this campaign), so a lead owned by someone else shows up
  // locked with its owner's name.
  const scope: CampaignLeadScope = search ? 'campaign' : 'mine'
  const {
    items: leads,
    total,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useCampaignLeadsPage({ campaignId, staffId: isAdmin ? adminStaffId : userId, anyStaff: isAdmin, scope, search, filters: listFilters })
  const campaign = campaigns.find((c) => c.id === campaignId)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <button
          onClick={() => navigate('/campaigns')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="text-[13.5px] font-semibold text-[var(--text-h)]">{campaign?.name ?? 'Pipeline'}</p>
          {!search && <p className="text-[12px] text-[var(--text-muted)]">{total} leads</p>}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 [&>form]:max-w-none">
            <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label={filterCount > 0 ? `Filters (${filterCount} on)` : 'Filters'}
            title="Filters"
            className={cn(
              'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[var(--text-h)] hover:bg-[var(--surface-hover)]',
              filterCount > 0 ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]' : 'border-[var(--border)]',
            )}
          >
            <Funnel size={15} />
            {filterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white">
                {filterCount}
              </span>
            )}
          </button>
          {filterCount > 0 && (
            <button
              type="button"
              onClick={() => applyFilters(NO_LEAD_FILTERS)}
              aria-label="Clear filters"
              title="Clear filters"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <CampaignLeadFilterDialog open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={applyFilters} showStaff={isAdmin} />
        {search && !isLoading && (
          <p className="text-[12px] text-[var(--text-muted)]">
            {total} {total === 1 ? 'result' : 'results'} for “{search}”
          </p>
        )}
        {search && otherPipelines.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">
            <span>Also found in:</span>
            {otherPipelines.map((p, i) => (
              <span key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/campaigns/${p.id}/leads?q=${encodeURIComponent(search)}`)}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {p.name}
                </button>{' '}
                ({p.count}){i < otherPipelines.length - 1 ? ' ·' : ''}
              </span>
            ))}
          </p>
        )}
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">
            {error instanceof Error ? error.message : 'Failed to load leads'}
          </p>
        ) : leads.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search
              ? `No results for “${search}”.`
              : filterCount > 0
                ? 'No leads match these filters.'
                : isAdmin
                ? 'No leads in this pipeline yet.'
                : 'No leads for you in this pipeline yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => {
              // Another executive's lead: view-only, can't be called from here.
              const ownedByOther = Boolean(lead.assign_to_staff_id) && lead.assign_to_staff_id !== userId
              // Admins can still open and call it.
              const othersLead = !isAdmin && ownedByOther
              // from=list: the executive picked this lead, so saving the call brings
              // them back here (keeping the search) instead of moving to the next queue lead.
              const open = () => {
                // The whole list address (search + filters) rides along so Back / saving returns to the same list.
                const params = new URLSearchParams(searchParams)
                params.set('from', 'list')
                navigate(`/campaigns/${campaignId}/call/${lead.id}?${params}`)
              }
              return (
                // A div, not a <button>: the WhatsApp links inside can't be nested in one.
                <div
                  key={lead.id}
                  role="button"
                  tabIndex={othersLead ? -1 : 0}
                  aria-disabled={othersLead}
                  onClick={() => {
                    if (!othersLead) open()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !othersLead) open()
                  }}
                  className={cn(
                    'rounded-xl border border-[var(--border)] p-3.5 text-left',
                    othersLead ? 'cursor-default opacity-75' : 'cursor-pointer hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={lead.contact_name ?? 'Unknown'} size={32} />
                    <div className="min-w-0 flex-1">
                      {/* Name, then the lead's status right after it. */}
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
                        <span className="shrink-0">
                          <Badge tone={lead.lead_status ? 'accent' : 'warning'}>{lead.lead_status ?? 'Fresh Inquiry'}</Badge>
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
                    </div>
                    {othersLead ? (
                      <Lock size={14} className="shrink-0 text-[var(--text-muted)]" />
                    ) : (
                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <LeadWhatsAppButtons
                          contactId={lead.contact_id}
                          phone={lead.contact_phone}
                          countryCode={lead.contact_country_code}
                          ownerStaffId={lead.assign_to_staff_id}
                        />
                      </div>
                    )}
                  </div>
                  {(lead.tag_name || !lead.assign_to_staff_id || ownedByOther) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {lead.tag_name && <Badge tone="neutral">{lead.tag_name}</Badge>}
                      {!lead.assign_to_staff_id && <Badge tone="warning">Unassigned</Badge>}
                      {ownedByOther && <Badge tone="neutral">{lead.assign_staff_name || 'Another executive'}</Badge>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
