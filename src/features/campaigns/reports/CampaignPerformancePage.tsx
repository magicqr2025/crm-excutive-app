import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, List, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useLeadStageTypes, useLeadStatuses, useMyLeadCampaigns } from '@/api/queries'
import { fetchPayments } from '@/api/crmApi'
import { fetchReportLeads } from '@/api/pipelineReportsApi'
import { formatDate } from '@/lib/dateFormat'
import { cn } from '@/lib/utils'
import { rupees } from '@/features/performance/performanceUtils'
import { TeamHeader } from '@/features/team/teamParts'
import { useTeam } from '@/features/team/teamQueries'
import { SELECT_CLASSES, errorText, staffName } from '@/features/team/teamUtils'
import { NO_LEAD_FILTERS, filtersToParams } from '../campaignLeadFilters'
import { conversion, isStuck, pipelineNumbers, revenuePeriod, untouchedShare, type PipelineNumbers, type ReportFilters } from './performanceData'

interface Row {
  id: string
  name: string
  createdAt: string
  numbers: PipelineNumbers
}

const SORTS: Record<string, { label: string; value: (r: Row) => number }> = {
  created: { label: 'Newest first', value: (r) => new Date(r.createdAt).getTime() || 0 },
  total: { label: 'Total leads', value: (r) => r.numbers.total },
  notStarted: { label: 'Not started', value: (r) => r.numbers.notStarted },
  inProgress: { label: 'In progress', value: (r) => r.numbers.inProgress },
  closed: { label: 'Closed', value: (r) => r.numbers.closed },
  conversion: { label: 'Conversion', value: (r) => conversion(r.numbers) },
  revenue: { label: 'Revenue', value: (r) => r.numbers.revenue },
}

/** Every pipeline's leads, progress, conversion and revenue. */
export function CampaignPerformancePage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('created')
  const filters: ReportFilters = {
    staffId: params.get('staff') ?? '',
    stageId: params.get('stage') ?? '',
    statusId: params.get('status') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  }
  const patch = (next: Record<string, string>) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(next)) {
          if (value) out.set(key, value)
          else out.delete(key)
        }
        return out
      },
      { replace: true },
    )

  const pipelines = useMyLeadCampaigns()
  const leads = useQuery({ queryKey: ['pipeline-report-leads', filters.staffId], queryFn: () => fetchReportLeads(filters.staffId) })
  const payments = useQuery({ queryKey: ['pipeline-report-payments'], queryFn: async () => (await fetchPayments()).payments })
  const stages = useLeadStageTypes()
  const statuses = useLeadStatuses()
  const { data: team = [] } = useTeam()

  // Every source must have arrived, so a half-loaded report is never shown as zeros.
  const sources = [pipelines, leads, payments, stages, statuses]
  const loading = sources.some((q) => q.isLoading)
  const failed = sources.find((q) => q.isError)

  const numbers = useMemo(
    () => pipelineNumbers((pipelines.data ?? []).map((p) => p.id), leads.data ?? [], statuses.data ?? [], stages.data ?? [], payments.data ?? [], filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filters` is rebuilt from these five values
    [pipelines.data, leads.data, statuses.data, stages.data, payments.data, filters.staffId, filters.stageId, filters.statusId, filters.from, filters.to],
  )
  const rows: Row[] = (pipelines.data ?? [])
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at, numbers: numbers.get(p.id)! }))
    .sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a) || a.name.localeCompare(b.name))

  const period = revenuePeriod(filters.from, filters.to)
  const stageStatuses = (statuses.data ?? []).filter((s) => s.stage_id === filters.stageId)
  const newStage = stages.data?.find((s) => s.lead_stage.trim().toLowerCase() === 'new')
  // The pipeline's own leads list, narrowed to its New stage with this report's staff and dates.
  const notStartedLink = (id: string) => {
    const query = filtersToParams(
      {
        ...NO_LEAD_FILTERS,
        stageId: newStage?.id ?? '',
        staffId: filters.staffId,
        ...(filters.from || filters.to ? { datePreset: 'custom' as const, from: filters.from, to: filters.to } : {}),
      },
      new URLSearchParams(),
    )
    return `/campaigns/${id}/leads?${query}`
  }
  const filtered = Object.values(filters).some(Boolean)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader title="Campaign Performance" subtitle="Leads, progress, conversion and revenue by pipeline." backTo="/campaigns" />
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-10 pt-4 md:px-6">
        <section className="space-y-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select aria-label="Staff member" value={filters.staffId} onChange={(e) => patch({ staff: e.target.value })} className={SELECT_CLASSES}>
              <option value="">All staff</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {staffName(m)}
                </option>
              ))}
            </select>
            <select aria-label="Lead stage" value={filters.stageId} onChange={(e) => patch({ stage: e.target.value, status: '' })} className={SELECT_CLASSES}>
              <option value="">All stages</option>
              {(stages.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lead_stage}
                </option>
              ))}
            </select>
            {/* A status belongs to a stage, so the stage is picked first. */}
            <select aria-label="Lead status" value={filters.statusId} disabled={!filters.stageId} onChange={(e) => patch({ status: e.target.value })} className={cn(SELECT_CLASSES, 'disabled:opacity-60')}>
              <option value="">{filters.stageId ? 'All statuses' : 'Choose a stage first'}</option>
              {stageStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lead_status}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:max-w-sm">
              <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => patch({ from: e.target.value })} />
              <Input type="date" aria-label="To date" value={filters.to} onChange={(e) => patch({ to: e.target.value })} />
            </div>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Reset
              </Button>
            )}
          </div>
          <p className="rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
            Lead counts: {filters.from || filters.to ? 'leads added in the chosen dates' : 'all time'}. Revenue: payments after refunds from {formatDate(period.from)} to {formatDate(period.to)}. A
            contact in two pipelines counts in both, so don’t add revenue across pipelines.
          </p>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pipelines…" aria-label="Search pipelines" className="h-11 sm:flex-1" />
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} className={cn(SELECT_CLASSES, 'sm:w-52')}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {key === 'created' ? s.label : `Most: ${s.label}`}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <PageLoader label="Loading leads and payments…" />
        ) : failed ? (
          <div className="space-y-2 py-8 text-center">
            <p role="alert" className="text-[13px] text-[var(--error)]">
              {errorText(failed.error)}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void Promise.all(sources.map((q) => q.refetch()))}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{pipelines.data?.length ? 'No pipeline matches.' : 'No pipelines yet.'}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ id, name, createdAt, numbers: n }) => (
              <li key={id} className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
                <div>
                  <p className="break-words text-[14.5px] font-semibold text-[var(--text-h)]">{name}</p>
                  <p className="text-[11.5px] text-[var(--text-muted)]">Created {formatDate(createdAt)}</p>
                </div>
                <dl className="grid grid-cols-3 gap-2">
                  {[
                    ['Total leads', n.total.toLocaleString()],
                    ['Not started', n.notStarted.toLocaleString()],
                    ['In progress', n.inProgress.toLocaleString()],
                    ['Closed', n.closed.toLocaleString()],
                    ['Conversion', `${conversion(n)}%`],
                    ['Revenue', rupees(n.revenue)],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-[var(--surface-hover)] px-2 py-1.5">
                      <dd className="truncate font-mono-num text-[14px] font-semibold text-[var(--text-h)]" title={value}>
                        {value}
                      </dd>
                      <dt className="truncate text-[11px] text-[var(--text-muted)]">{label}</dt>
                    </div>
                  ))}
                </dl>
                {isStuck(n) && (
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--warning)]">
                    <AlertTriangle size={14} aria-hidden /> {untouchedShare(n)}% of leads not started
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <LinkButton to={`/campaigns/${id}/leads`}>
                    <List size={14} /> Leads
                  </LinkButton>
                  {n.notStarted > 0 && newStage && <LinkButton to={notStartedLink(id)}>Not started</LinkButton>}
                  <LinkButton to={`/campaigns/${id}/call-logs`}>
                    <PhoneCall size={14} /> Calls
                  </LinkButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function LinkButton({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border)] px-3 text-[12.5px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]">
      {children}
    </Link>
  )
}
