// The Campaign Performance numbers. Same rules as orm-whatsapp (pipelineData.ts, usePipelineRows.ts and
// pipelineInsights.ts): keep them in step, so both apps show the same figures.

export interface ReportLead {
  contact_id: string
  lead_status: string | null
  created_at: string
  lead_campaigns: { id: string }[]
}

export interface ReportStatus {
  id: string
  lead_status: string
  stage_id: string
}

export interface ReportPayment {
  contact_id: string
  amount: number
  kind: 'payment' | 'refund'
  status: number
  payment_date: string | null
  created_at: string
}

export interface ReportFilters {
  staffId: string
  stageId: string
  statusId: string
  from: string
  to: string
}

export interface PipelineNumbers {
  total: number
  /** Still in the "New" stage. */
  notStarted: number
  inProgress: number
  closed: number
  converted: number
  /** Payments received in the revenue period from this pipeline's contacts. A contact in two pipelines counts in both. */
  revenue: number
}

const DEFAULT_REVENUE_DAYS = 30

/** YYYY-MM-DD in local time. */
export function localDay(value: Date | string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The days revenue is counted over: the chosen dates, otherwise the last 30 days (lead counts are then all time). */
export function revenuePeriod(from: string, to: string, now = new Date()): { from: string; to: string } {
  const end = to || localDay(now)
  const [y, m, d] = end.split('-').map(Number)
  return { from: from || localDay(new Date(y, m - 1, d - (DEFAULT_REVENUE_DAYS - 1))), to: end }
}

// A plain date is already a local day; reading it as a timestamp would shift it by the time zone.
const paymentDay = (p: ReportPayment) => {
  const raw = p.payment_date ?? p.created_at
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : localDay(raw)
}

/** Refunds subtract; voided payments count as nothing. */
const netAmount = (p: ReportPayment) => (p.status !== 1 ? 0 : (p.kind === 'refund' ? -1 : 1) * Number(p.amount))

const empty = (): PipelineNumbers => ({ total: 0, notStarted: 0, inProgress: 0, closed: 0, converted: 0, revenue: 0 })

export function pipelineNumbers(
  pipelineIds: string[],
  leads: ReportLead[],
  statuses: ReportStatus[],
  stages: { id: string; lead_stage: string }[],
  payments: ReportPayment[],
  filters: ReportFilters,
  now = new Date(),
): Map<string, PipelineNumbers> {
  const stageName = new Map(stages.map((s) => [s.id, s.lead_stage.trim().toLowerCase()]))
  // Leads carry their status by name.
  const statusByName = new Map(statuses.map((s) => [s.lead_status, s]))
  const rows = new Map(pipelineIds.map((id) => [id, empty()]))
  const pipelinesByContact = new Map<string, Set<string>>()

  for (const lead of leads) {
    const status = lead.lead_status ? statusByName.get(lead.lead_status) : undefined
    if (filters.stageId && status?.stage_id !== filters.stageId) continue
    if (filters.statusId && status?.id !== filters.statusId) continue

    // Revenue looks at every matching lead, whenever it was added.
    const known = pipelinesByContact.get(lead.contact_id) ?? new Set<string>()
    for (const c of lead.lead_campaigns) known.add(c.id)
    pipelinesByContact.set(lead.contact_id, known)

    const day = localDay(lead.created_at)
    if ((filters.from && day < filters.from) || (filters.to && day > filters.to)) continue
    const stage = status ? (stageName.get(status.stage_id) ?? '') : null
    for (const c of lead.lead_campaigns) {
      const row = rows.get(c.id)
      if (!row) continue
      row.total += 1
      // A lead with no status is in no stage, so it is only part of the total.
      if (stage === null) continue
      if (stage === 'new') row.notStarted += 1
      else if (stage === 'converted' || stage === 'rejected') row.closed += 1
      else row.inProgress += 1
      if (stage === 'converted') row.converted += 1
    }
  }

  const period = revenuePeriod(filters.from, filters.to, now)
  for (const payment of payments) {
    const day = paymentDay(payment)
    if (!day || day < period.from || day > period.to) continue
    for (const id of pipelinesByContact.get(payment.contact_id) ?? []) {
      const row = rows.get(id)
      if (row) row.revenue += netAmount(payment)
    }
  }
  return rows
}

/** Percent with one decimal, as orm-whatsapp shows conversion. */
export const conversion = (n: PipelineNumbers) => (n.total > 0 ? Math.round((n.converted / n.total) * 1000) / 10 : 0)

export const untouchedShare = (n: PipelineNumbers) => (n.total > 0 ? Math.round((n.notStarted / n.total) * 100) : 0)

/** Flagged when at least half of the leads, and 20 or more, have not been started. */
export const isStuck = (n: PipelineNumbers) => n.notStarted >= 20 && untouchedShare(n) >= 50
