import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ExternalLink, PhoneMissed } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Input } from '@/components/ui/Input'
import { SearchBox } from '@/components/ui/SearchBox'
import { PageLoader } from '@/components/ui/Spinner'
import { fetchTeamCalls, type CallFilters, type CallResult, type CallSummary, type TeamCall } from '@/api/pipelineReportsApi'
import { formatDate } from '@/lib/dateFormat'
import { usePagedList } from '@/lib/usePagedList'
import { cn } from '@/lib/utils'
import { pct, rangeForPreset, talkTime, toDay } from '@/features/performance/performanceUtils'
import { chipClass } from '@/features/reports/reportStyles'
import { TeamHeader } from '@/features/team/teamParts'
import { useTeam } from '@/features/team/teamQueries'
import { SELECT_CLASSES, errorText, staffName } from '@/features/team/teamUtils'
import { usePipeline } from '../admin/pipelineQueries'

function quickRanges() {
  const now = new Date()
  return [
    { label: 'Today', ...rangeForPreset('today') },
    { label: 'Yesterday', ...rangeForPreset('yesterday') },
    { label: 'Last 7 days', ...rangeForPreset('7d') },
    { label: 'This month', from: toDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDay(now) },
    { label: 'Last month', from: toDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toDay(new Date(now.getFullYear(), now.getMonth(), 0)) },
  ]
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')

function ResultBadge({ outcome }: { outcome: TeamCall['outcome'] }) {
  if (outcome === 'connected') return <Badge tone="success">Connected</Badge>
  if (outcome === 'not_connected') return <Badge tone="error">Not connected</Badge>
  return <Badge tone="neutral">Not reviewed</Badge>
}

function TypeIcon({ type }: { type: TeamCall['call_type'] }) {
  if (type === 'incoming') return <ArrowDownLeft size={14} aria-label="Incoming" className="shrink-0 text-[var(--accent)]" />
  if (type === 'missed') return <PhoneMissed size={14} aria-label="Missed" className="shrink-0 text-[var(--error)]" />
  return <ArrowUpRight size={14} aria-label="Outgoing" className="shrink-0 text-[var(--accent-strong)]" />
}

/** Every call the team made in one pipeline, newest first. */
export function PipelineCallLogsPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const [params, setParams] = useSearchParams()
  const pipeline = usePipeline(campaignId)
  const { data: team = [] } = useTeam()
  const [opened, setOpened] = useState<TeamCall | null>(null)

  // Filters live in the address, so opening a contact and coming back keeps them.
  const filters: CallFilters = {
    staffId: params.get('staff') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    result: (['connected', 'not_connected', 'unreviewed'].includes(params.get('result') ?? '') ? params.get('result') : '') as CallResult | '',
    search: params.get('q') ?? '',
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

  const backwards = !!filters.from && !!filters.to && filters.from > filters.to
  const list = usePagedList({
    queryKey: ['pipeline-calls', campaignId, filters],
    fetchPage: (page) => fetchTeamCalls(campaignId, filters, page),
    enabled: !!campaignId && !backwards,
  })
  const summary = list.summary as CallSummary | undefined
  const totals = summary?.totals
  const mostCalls = Math.max(1, ...(summary?.by_staff ?? []).map((r) => r.calls))
  const filtered = Object.values(filters).some(Boolean)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader title="Call Logs" subtitle={pipeline.data?.name ?? 'Pipeline'} backTo={`/campaigns/${campaignId}/leads`} />
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-10 pt-4 md:px-6">
        <section className="space-y-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
          <div className="[&>form]:max-w-none">
            <SearchBox value={filters.search} onSubmit={(q) => patch({ q: q.slice(0, 100) })} placeholder="Name, number or what was discussed" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="Staff member" value={filters.staffId} onChange={(e) => patch({ staff: e.target.value })} className={SELECT_CLASSES}>
              <option value="">Everyone</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {staffName(m)}
                </option>
              ))}
            </select>
            <select aria-label="Result" value={filters.result} onChange={(e) => patch({ result: e.target.value })} className={SELECT_CLASSES}>
              <option value="">All results</option>
              <option value="connected">Connected</option>
              <option value="not_connected">Not connected</option>
              <option value="unreviewed">Not reviewed</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            {/* Picking one end fills the other, because the server needs both. */}
            <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => patch({ from: e.target.value, to: e.target.value ? filters.to || e.target.value : '' })} />
            <Input type="date" aria-label="To date" value={filters.to} onChange={(e) => patch({ to: e.target.value, from: e.target.value ? filters.from || e.target.value : '' })} />
          </div>
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
            {quickRanges().map((r) => {
              const on = filters.from === r.from && filters.to === r.to
              return (
                <button key={r.label} type="button" aria-pressed={on} onClick={() => patch(on ? { from: '', to: '' } : { from: r.from, to: r.to })} className={chipClass(on)}>
                  {r.label}
                </button>
              )
            })}
            {filtered && (
              <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} className={chipClass(false)}>
                Reset
              </button>
            )}
          </div>
        </section>

        {backwards ? (
          <p className="py-6 text-center text-[13px] text-[var(--error)]">The start day is after the end day.</p>
        ) : list.isLoading ? (
          <PageLoader label="Loading calls…" />
        ) : list.isError ? (
          <p role="alert" className="py-6 text-center text-[13px] text-[var(--error)]">
            {errorText(list.error)}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[
                { label: 'Calls', value: (totals?.calls ?? 0).toLocaleString(), sub: `${totals?.unreviewed ?? 0} not reviewed` },
                { label: 'Connected', value: (totals?.connected ?? 0).toLocaleString(), sub: `${pct(totals?.connected ?? 0, totals?.calls ?? 0)}% of calls` },
                { label: 'Not connected', value: (totals?.not_connected ?? 0).toLocaleString(), sub: '' },
                { label: 'Talk time', value: talkTime(totals?.total_seconds ?? 0), sub: totals?.calls ? `${talkTime(Math.round(totals.total_seconds / totals.calls))} per call` : '' },
              ].map((t) => (
                <div key={t.label} className="rounded-xl bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
                  <dt className="text-[11.5px] text-[var(--text-muted)]">{t.label}</dt>
                  <dd className="font-mono-num text-[20px] font-semibold text-[var(--text-h)]">{t.value}</dd>
                  <dd className="text-[11px] text-[var(--text-muted)]">{t.sub}</dd>
                </div>
              ))}
            </dl>

            {(summary?.by_staff.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h2 className="text-[14px] font-semibold text-[var(--text-h)]">By staff</h2>
                <ul className="grid gap-2 md:grid-cols-2">
                  {summary!.by_staff.map((row) => {
                    const on = !!row.staff_id && row.staff_id === filters.staffId
                    return (
                      <li key={row.staff_id ?? 'none'}>
                        <button
                          type="button"
                          disabled={!row.staff_id}
                          aria-pressed={on}
                          onClick={() => patch({ staff: on ? '' : row.staff_id! })}
                          className={cn('block w-full rounded-xl p-3 text-left ring-1', on ? 'bg-[var(--accent-bg)] ring-[var(--accent)]' : 'bg-[var(--surface)] ring-[var(--border)]')}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{row.staff_name}</span>
                            <span className="shrink-0 font-mono-num text-[13.5px] font-semibold text-[var(--text-h)]">{row.calls} calls</span>
                          </span>
                          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                            <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct(row.calls, mostCalls)}%` }} />
                          </span>
                          <span className="mt-1.5 block text-[12px] text-[var(--text-muted)]">
                            {row.connected} connected ({pct(row.connected, row.calls)}%) · {row.not_connected} not connected · {talkTime(row.total_seconds)}
                          </span>
                          <span className="block text-[11.5px] text-[var(--text-muted)]">Last call: {when(row.last_call_at)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-[14px] font-semibold text-[var(--text-h)]">All calls · {list.total.toLocaleString()}</h2>
              {list.items.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">{filtered ? 'No calls match these filters.' : 'No calls yet in this pipeline.'}</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
                  {list.items.map((call) => (
                    <li key={call.id}>
                      <button type="button" onClick={() => setOpened(call)} className="block w-full px-3.5 py-3 text-left hover:bg-[var(--surface-hover)]">
                        <span className="flex items-center gap-2">
                          <TypeIcon type={call.call_type} />
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--text-h)]">{call.contact_name ?? 'Unknown'}</span>
                          <ResultBadge outcome={call.outcome} />
                        </span>
                        <span className="mt-1 block truncate text-[12px] text-[var(--text-muted)]">
                          {[call.staff_name ?? '—', when(call.occurred_at), call.duration_seconds != null ? talkTime(call.duration_seconds) : null].filter(Boolean).join(' · ')}
                        </span>
                        <span className="mt-0.5 line-clamp-2 break-words text-[12.5px] text-[var(--text)]">{call.remark || call.reason || 'No discussion noted'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <InfiniteScrollFooter hasNextPage={Boolean(list.hasNextPage)} isFetchingNextPage={list.isFetchingNextPage} onLoadMore={() => void list.fetchNextPage()} />
            </section>
          </>
        )}
      </div>
      {opened && <CallDetail call={opened} onClose={() => setOpened(null)} />}
    </div>
  )
}

function CallDetail({ call, onClose }: { call: TeamCall; onClose: () => void }) {
  const facts: [string, string | null][] = [
    ['Called by', call.staff_name ?? '—'],
    ['When', when(call.occurred_at)],
    ['Type', call.call_type === 'incoming' ? 'Incoming' : call.call_type === 'missed' ? 'Missed' : 'Outgoing'],
    ['Number', call.contact_phone],
    ['Talk time', call.duration_seconds != null ? talkTime(call.duration_seconds) : 'Not recorded'],
    ['Lead status', call.lead_status],
    ['Reason', call.reason],
    ['Follow-up set', call.followup_date ? [formatDate(call.followup_date), call.followup_time ? call.followup_time.slice(11, 16) || call.followup_time.slice(0, 5) : ''].filter(Boolean).join(' · ') : null],
  ]
  return (
    <Dialog open onClose={onClose} className="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title className="truncate">{call.contact_name ?? 'Call'}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3">
        <ResultBadge outcome={call.outcome} />
        <dl className="divide-y divide-[var(--border)] text-[13.5px]">
          {facts.map(
            ([label, value]) =>
              value && (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="shrink-0 text-[var(--text-muted)]">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium text-[var(--text-h)]">{value}</dd>
                </div>
              ),
          )}
        </dl>
        <div>
          <p className="mb-1 text-[12.5px] text-[var(--text-muted)]">What was discussed</p>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-hover)] p-3 text-[13.5px] text-[var(--text-h)]">
            {call.remark || (call.outcome ? 'No notes were written for this call.' : 'This call was synced from a phone and nobody has filed notes for it yet.')}
          </p>
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {call.lead_id && (
          <Link to={`/contacts/${call.lead_id}`} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-white">
            <ExternalLink size={14} /> Open contact
          </Link>
        )}
      </Dialog.Footer>
    </Dialog>
  )
}
