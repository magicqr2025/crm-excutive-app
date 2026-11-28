// The Sales Dashboard's numbers. Same rules as orm-whatsapp's Sales Pipeline page (CampaignsPage.tsx,
// pipelineData.ts, pipelineInsights.ts): keep them in step, so both apps show the same figures.
import { localDay, netAmount, paymentDay, type ReportFilters, type ReportLead, type ReportPayment, type ReportStatus } from './performanceData.ts'

export interface DashboardFilters extends ReportFilters {
  pipelineId: string
}

export interface Stage {
  id: string
  lead_stage: string
}

/** The chosen dates, or the last 30 days, with the same-length period before it. */
export interface DashboardPeriod {
  from: string
  to: string
  prevFrom: string
  prevTo: string
  /** Every day charted, oldest first (a year at most). */
  days: string[]
  chosen: boolean
}

const DEFAULT_DAYS = 30
const MAX_CHART_DAYS = 366

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + n))
}

const utc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function dashboardPeriod(from: string, to: string, now = new Date()): DashboardPeriod {
  const end = to || localDay(now)
  const start = from || addDays(end, -(DEFAULT_DAYS - 1))
  const length = Math.max(1, Math.round((utc(end) - utc(start)) / 86_400_000) + 1)
  const charted = Math.min(length, MAX_CHART_DAYS)
  const first = addDays(end, -(charted - 1))
  return {
    from: start,
    to: end,
    prevFrom: addDays(start, -length),
    prevTo: addDays(start, -1),
    days: Array.from({ length: charted }, (_, i) => addDays(first, i)),
    chosen: !!(from || to),
  }
}

/** Percent change, or null when there is nothing to compare with. */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export interface Followup {
  contact_id: string
  followup_date: string
  followup_status: string
}

export interface Meeting {
  id: string
  contact_id: string
  meeting_status: string
  meeting_time: string
}

export interface FunnelRow {
  id: string
  label: string
  count: number
  /** Share of the stage before that moved on to this one (all-stages view only). */
  movedOn: number | null
}

export const NO_STAGE_ID = '__none__'

function sumByDay<T>(days: string[], items: T[], dayOf: (item: T) => string, valueOf: (item: T) => number): number[] {
  const at = new Map(days.map((d, i) => [d, i]))
  const out = days.map(() => 0)
  for (const item of items) {
    const i = at.get(dayOf(item))
    if (i !== undefined) out[i] += valueOf(item)
  }
  return out
}

export function dashboardNumbers<M extends Meeting>(
  input: {
    leads: ReportLead[]
    statuses: ReportStatus[]
    stages: Stage[]
    payments: ReportPayment[]
    followups: Followup[]
    meetings: M[]
  },
  filters: DashboardFilters,
  now = new Date(),
) {
  const { leads, statuses, stages, payments, followups, meetings } = input
  const statusByName = new Map(statuses.map((s) => [s.lead_status, s]))
  const statusOf = (lead: ReportLead) => (lead.lead_status ? statusByName.get(lead.lead_status) : undefined)
  const stageNameOf = new Map(stages.map((s) => [s.id, s.lead_stage.trim().toLowerCase()]))
  const period = dashboardPeriod(filters.from, filters.to, now)
  const today = localDay(now)

  // "In scope" = pipeline, stage and status filters, whenever the lead was added.
  const scope = leads.filter((lead) => {
    const status = statusOf(lead)
    if (filters.stageId && status?.stage_id !== filters.stageId) return false
    if (filters.statusId && status?.id !== filters.statusId) return false
    return !filters.pipelineId || lead.lead_campaigns.some((c) => c.id === filters.pipelineId)
  })
  // The lead counts also respect the chosen dates.
  const dated = scope.filter((lead) => {
    const day = localDay(lead.created_at)
    return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
  })

  const summary = { total: dated.length, notStarted: 0, inProgress: 0, closed: 0, converted: 0, noStage: 0 }
  const byStage = new Map<string, number>()
  const byStatus = new Map<string, number>()
  for (const lead of dated) {
    const status = statusOf(lead)
    if (!status) {
      summary.noStage += 1
      continue
    }
    byStage.set(status.stage_id, (byStage.get(status.stage_id) ?? 0) + 1)
    byStatus.set(status.id, (byStatus.get(status.id) ?? 0) + 1)
    const stage = stageNameOf.get(status.stage_id) ?? ''
    if (stage === 'new') summary.notStarted += 1
    else if (stage === 'converted' || stage === 'rejected') summary.closed += 1
    else summary.inProgress += 1
    if (stage === 'converted') summary.converted += 1
  }

  // A lead counts for every stage up to the one it is in now ("reached"), except when one stage is filtered.
  const visible = stages.filter((s) => !filters.stageId || s.id === filters.stageId)
  const steps = visible.filter((s) => stageNameOf.get(s.id) !== 'rejected')
  const reached = steps.map((s, i) => (filters.stageId ? (byStage.get(s.id) ?? 0) : steps.slice(i).reduce((sum, x) => sum + (byStage.get(x.id) ?? 0), 0)))
  const funnel: FunnelRow[] = steps.map((s, i) => ({
    id: s.id,
    label: s.lead_stage,
    count: reached[i],
    movedOn: i === 0 || filters.stageId || reached[i - 1] === 0 ? null : Math.round((reached[i] / reached[i - 1]) * 1000) / 10,
  }))
  for (const s of visible.filter((x) => stageNameOf.get(x.id) === 'rejected')) funnel.push({ id: s.id, label: s.lead_stage, count: byStage.get(s.id) ?? 0, movedOn: null })
  if (summary.noStage > 0) funnel.push({ id: NO_STAGE_ID, label: 'No stage', count: summary.noStage, movedOn: null })

  const contacts = new Set(scope.map((l) => l.contact_id))
  const createdDays = scope.map((l) => localDay(l.created_at))
  const within = (day: string, from: string, to: string) => !!day && day >= from && day <= to
  const scopePayments = payments.filter((p) => contacts.has(p.contact_id))
  const revenueIn = (from: string, to: string) => scopePayments.filter((p) => within(paymentDay(p), from, to)).reduce((sum, p) => sum + netAmount(p), 0)

  const open = followups.filter((f) => f.followup_status !== '2' && contacts.has(f.contact_id) && f.followup_date)
  const due = open.filter((f) => f.followup_date.slice(0, 10) <= today)
  const overdue = due.filter((f) => f.followup_date.slice(0, 10) < today)

  const scheduled = meetings.filter((m) => m.meeting_status === 'scheduled' && contacts.has(m.contact_id))
  const upcoming = scheduled
    .filter((m) => new Date(m.meeting_time).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.meeting_time).getTime() - new Date(b.meeting_time).getTime())

  return {
    period,
    summary,
    funnel,
    /** Leads in each status (for opening one stage up). */
    byStatus,
    leads: {
      now: createdDays.filter((d) => within(d, period.from, period.to)).length,
      previous: createdDays.filter((d) => within(d, period.prevFrom, period.prevTo)).length,
      series: sumByDay(period.days, createdDays, (d) => d, () => 1),
    },
    revenue: {
      now: revenueIn(period.from, period.to),
      previous: revenueIn(period.prevFrom, period.prevTo),
      series: sumByDay(period.days, scopePayments, paymentDay, netAmount),
    },
    followups: { due: due.length, overdue: overdue.length, oldest: overdue.map((f) => f.followup_date.slice(0, 10)).sort()[0] ?? null },
    meetings: {
      today: scheduled.filter((m) => localDay(m.meeting_time) === today).length,
      nextToday: upcoming.find((m) => localDay(m.meeting_time) === today) ?? null,
      upcoming: upcoming.slice(0, 3),
    },
  }
}
