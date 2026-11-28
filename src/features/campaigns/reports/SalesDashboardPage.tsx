import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlarmClock, CalendarClock, CheckCircle2, CircleAlert, IndianRupee, UserX, Users, Video } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useLeadStageTypes, useLeadStatuses, useMyLeadCampaigns } from '@/api/queries'
import { fetchMeetings, fetchPayments } from '@/api/crmApi'
import { fetchOpenFollowups, fetchReportLeads } from '@/api/pipelineReportsApi'
import { formatDate } from '@/lib/dateFormat'
import { cn } from '@/lib/utils'
import { pct, rupees } from '@/features/performance/performanceUtils'
import { TeamHeader } from '@/features/team/teamParts'
import { useTeam } from '@/features/team/teamQueries'
import { SELECT_CLASSES, errorText, staffName } from '@/features/team/teamUtils'
import { changePct, dashboardNumbers, type DashboardFilters } from './dashboardData'
import { conversion, pipelineNumbers } from './performanceData'
import { notStartedLink } from './notStartedLink'
import { Headline, Panel, StageFunnel, TrendBars } from './SalesDashboardParts'

const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

interface Action {
  icon: typeof AlarmClock
  color: string
  title: string
  detail: string
  /** Left out when no page shows exactly these leads. */
  link?: { to: string; label: string }
}

export function SalesDashboardPage() {
  const [params, setParams] = useSearchParams()
  const filters: DashboardFilters = {
    pipelineId: params.get('pipeline') ?? '',
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
  const followups = useQuery({ queryKey: ['pipeline-report-followups'], queryFn: fetchOpenFollowups })
  const meetings = useQuery({ queryKey: ['pipeline-report-meetings'], queryFn: () => fetchMeetings() })
  const stages = useLeadStageTypes()
  const statuses = useLeadStatuses()
  const { data: team = [] } = useTeam()

  // Everything must have arrived, so a half-loaded dashboard is never shown as zeros.
  const sources = [pipelines, leads, payments, followups, meetings, stages, statuses]
  const loading = sources.some((q) => q.isLoading)
  const failed = sources.find((q) => q.isError)
  // The time the page was opened: "upcoming" and "overdue" are measured from it.
  const [openedAt] = useState(() => new Date())

  const data = useMemo(
    () =>
      dashboardNumbers(
        { leads: leads.data ?? [], statuses: statuses.data ?? [], stages: stages.data ?? [], payments: payments.data ?? [], followups: followups.data ?? [], meetings: meetings.data ?? [] },
        filters,
        openedAt,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filters` is rebuilt from these six values
    [leads.data, statuses.data, stages.data, payments.data, followups.data, meetings.data, openedAt, filters.pipelineId, filters.staffId, filters.stageId, filters.statusId, filters.from, filters.to],
  )

  // Per pipeline, with every filter except the pipeline one.
  const all = pipelines.data ?? []
  const perPipeline = pipelineNumbers(all.map((p) => p.id), leads.data ?? [], statuses.data ?? [], stages.data ?? [], payments.data ?? [], filters, openedAt)
  const newest = [...all].sort((a, b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0)).slice(0, 4)

  const { summary, period } = data
  const newStageId = stages.data?.find((s) => s.lead_stage.trim().toLowerCase() === 'new')?.id
  const periodText = period.chosen ? 'chosen dates' : 'last 30 days'
  const performanceQuery = new URLSearchParams(
    Object.entries({ staff: filters.staffId, stage: filters.stageId, status: filters.statusId, from: filters.from, to: filters.to }).filter(([, v]) => v),
  ).toString()
  const performanceLink = `/campaigns/performance${performanceQuery ? `?${performanceQuery}` : ''}`

  const actions: Action[] = []
  if (data.followups.overdue > 0) {
    actions.push({
      icon: AlarmClock,
      color: 'var(--error)',
      title: `${data.followups.overdue} follow-up${data.followups.overdue === 1 ? '' : 's'} overdue`,
      detail: data.followups.oldest ? `Oldest was due ${formatDate(data.followups.oldest)}` : 'Past their due date',
      link: { to: '/followups', label: 'Follow-ups' },
    })
  }
  if (summary.notStarted > 0) {
    // The pipeline picked above, otherwise the one with the most leads waiting.
    const top = filters.pipelineId
      ? all.find((p) => p.id === filters.pipelineId)
      : [...all].sort((a, b) => (perPipeline.get(b.id)?.notStarted ?? 0) - (perPipeline.get(a.id)?.notStarted ?? 0))[0]
    const inTop = top ? (perPipeline.get(top.id)?.notStarted ?? 0) : 0
    actions.push({
      icon: UserX,
      color: 'var(--warning)',
      title: `${summary.notStarted} lead${summary.notStarted === 1 ? '' : 's'} not started`,
      detail: top && inTop > 0 && !filters.pipelineId ? `Most in ${top.name} (${inTop})` : 'Still in New',
      link: top && inTop > 0 && newStageId ? { to: notStartedLink(top.id, newStageId, filters), label: 'Open leads' } : undefined,
    })
  }
  if (data.meetings.today > 0) {
    const next = data.meetings.nextToday
    actions.push({
      icon: CalendarClock,
      color: 'var(--accent)',
      title: `${data.meetings.today} meeting${data.meetings.today === 1 ? '' : 's'} today`,
      detail: next ? `Next at ${timeOfDay(next.meeting_time)} with ${next.contact_name || 'a contact'}` : 'All of today’s meetings have started',
      link: { to: '/meetings', label: 'Meetings' },
    })
  }
  if (summary.noStage > 0) {
    actions.push({ icon: CircleAlert, color: 'var(--text-muted)', title: `${summary.noStage} lead${summary.noStage === 1 ? '' : 's'} with no stage`, detail: 'They don’t count toward any stage' })
  }

  const stageStatuses = (statuses.data ?? []).filter((s) => s.stage_id === filters.stageId)
  const filtered = Object.values(filters).some(Boolean)
  const backwards = !!filters.from && !!filters.to && filters.from > filters.to
  const select = (label: string, value: string, key: string, first: string, options: { id: string; name: string }[], extra: Record<string, string> = {}, disabled = false): ReactNode => (
    <select aria-label={label} value={value} disabled={disabled} onChange={(e) => patch({ [key]: e.target.value, ...extra })} className={cn(SELECT_CLASSES, 'disabled:opacity-60')}>
      <option value="">{first}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader title="Sales Dashboard" subtitle="Your pipelines at a glance." backTo="/campaigns" />
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-10 pt-4 md:px-6">
        <section className="space-y-2 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {select('Pipeline', filters.pipelineId, 'pipeline', 'All pipelines', all.map((p) => ({ id: p.id, name: p.name })))}
            {select('Staff member', filters.staffId, 'staff', 'All staff', team.map((m) => ({ id: m.user_id, name: staffName(m) })))}
            {select('Lead stage', filters.stageId, 'stage', 'All stages', (stages.data ?? []).map((s) => ({ id: s.id, name: s.lead_stage })), { status: '' })}
            {select('Lead status', filters.statusId, 'status', filters.stageId ? 'All statuses' : 'Choose a stage first', stageStatuses.map((s) => ({ id: s.id, name: s.lead_status })), {}, !filters.stageId)}
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
        </section>

        {backwards ? (
          <p className="py-6 text-center text-[13px] text-[var(--error)]">The start day is after the end day.</p>
        ) : loading ? (
          <PageLoader label="Loading your numbers…" />
        ) : failed ? (
          <div className="space-y-2 py-8 text-center">
            <p role="alert" className="text-[13px] text-[var(--error)]">
              {errorText(failed.error)}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void Promise.all(sources.map((q) => q.refetch()))}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Headline
                icon={Users}
                label="Total leads"
                value={summary.total.toLocaleString()}
                change={changePct(data.leads.now, data.leads.previous)}
                hint={`${data.leads.now} added, ${periodText}`}
                to={performanceLink}
              />
              <Headline
                icon={CheckCircle2}
                label="Converted"
                value={summary.converted.toLocaleString()}
                hint={`${pct(summary.converted, summary.total)}% of leads${summary.closed ? ` · ${pct(summary.converted, summary.closed)}% win rate` : ''}`}
              />
              <Headline icon={IndianRupee} label="Revenue" value={rupees(data.revenue.now)} change={changePct(data.revenue.now, data.revenue.previous)} hint={`Payments received, ${periodText}`} />
              <Headline
                icon={AlarmClock}
                label="Follow-ups due"
                value={data.followups.due.toLocaleString()}
                hint={data.followups.overdue ? `${data.followups.overdue} overdue` : 'None overdue'}
                alert={data.followups.overdue > 0}
                to="/followups"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Pipeline stages">
                <p className="text-[12px] text-[var(--text-muted)]">
                  {filters.stageId ? 'Leads in the chosen stage.' : 'Each main stage counts the leads that reached it or went further.'} Tap a stage to see how many are in each of its statuses now.
                </p>
                <StageFunnel rows={data.funnel} total={summary.total} statuses={statuses.data ?? []} byStatus={data.byStatus} />
              </Panel>
              <Panel title="Trends" action={<span className="text-[12px] text-[var(--text-muted)]">{periodText}</span>}>
                <TrendBars days={period.days} leads={data.leads.series} revenue={data.revenue.series} />
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title={`Needs attention${actions.length ? ` (${actions.length})` : ''}`}>
                {actions.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">Nothing needs attention right now.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {actions.map((a) => (
                      <li key={a.title} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <a.icon size={18} aria-hidden className="shrink-0" style={{ color: a.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-[var(--text-h)]">{a.title}</span>
                          <span className="block break-words text-[12px] text-[var(--text-muted)]">{a.detail}</span>
                        </span>
                        {a.link && (
                          <Link to={a.link.to} className="flex h-9 shrink-0 items-center rounded-full border border-[var(--border)] px-3 text-[12.5px] font-medium text-[var(--accent-strong)]">
                            {a.link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Newest pipelines"
                action={
                  <Link to={performanceLink} className="text-[12.5px] font-medium text-[var(--accent-strong)]">
                    View all
                  </Link>
                }
              >
                {newest.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">No pipelines yet.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {newest.map((p) => {
                      const n = perPipeline.get(p.id)!
                      return (
                        <li key={p.id}>
                          <Link to={`/campaigns/${p.id}/leads`} className="block py-2.5 hover:bg-[var(--surface-hover)]">
                            <span className="block truncate text-[13.5px] font-semibold text-[var(--text-h)]">{p.name}</span>
                            <span className="block text-[12px] text-[var(--text-muted)]">
                              {n.total} leads · {conversion(n)}% converted · {rupees(n.revenue)}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Upcoming meetings"
                action={
                  <Link to="/meetings" className="text-[12.5px] font-medium text-[var(--accent-strong)]">
                    View all
                  </Link>
                }
              >
                {data.meetings.upcoming.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">No upcoming meetings.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {data.meetings.upcoming.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-[var(--text-h)]">{m.contact_name || 'Unnamed contact'}</span>
                          <span className="block text-[12px] text-[var(--text-muted)]">
                            {formatDate(m.meeting_time)} · {timeOfDay(m.meeting_time)}
                          </span>
                        </span>
                        {/* Only a web address is opened as a link. */}
                        {m.meeting_link && /^https?:\/\//i.test(m.meeting_link) && (
                          <a href={m.meeting_link} target="_blank" rel="noreferrer" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-[12.5px] font-medium text-white">
                            <Video size={13} /> Join
                          </a>
                        )}
                        <Link to={`/meetings/${m.id}`} className="flex h-9 shrink-0 items-center rounded-full border border-[var(--border)] px-3 text-[12.5px] font-medium text-[var(--text-h)]">
                          View
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
