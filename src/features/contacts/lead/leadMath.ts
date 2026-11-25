import type { CrmCallLog, CrmDeal, CrmFollowup, CrmMeeting, CrmPayment } from '@/api/crmApi'

// Numbers for one lead's page, worked out from the lists the page already loads.

/**
 * A follow-up's real moment. followup_date/followup_time hold India wall-clock digits (see
 * lib/followupFormat.ts), so read them as +05:30 instead of the viewer's own zone.
 */
export function followupInstant(f: Pick<CrmFollowup, 'followup_date' | 'followup_time'>): Date | null {
  const ymd = f.followup_date?.slice(0, 10)
  if (!ymd) return null
  const t = f.followup_time ?? ''
  const hm = t.length > 8 ? t.slice(11, 16) : t.slice(0, 5)
  const d = new Date(`${ymd}T${hm || '00:00'}:00+05:30`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatRupees(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** "Today, 3:00 pm", "Tomorrow, 11:30 am" or "Mon 30 Nov, 4:21 pm". */
export function whenLabel(at: Date, now = new Date()) {
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay(at, now)) return `Today, ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (sameDay(at, tomorrow)) return `Tomorrow, ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(at, yesterday)) return `Yesterday, ${time}`
  return `${at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`
}

export function callConnected(log: CrmCallLog) {
  return log.source === 'device_sync' ? Boolean(log.duration_seconds) : log.outcome === 'connected'
}

export interface LeadTotals {
  calls: number
  connected: number
  openFollowups: number
  meetings: number
  scheduledMeetings: number
  deals: number
  dealValue: number
  balance: number
  payments: number
  received: number
}

export function leadTotals(input: {
  calls: CrmCallLog[]
  followups: CrmFollowup[]
  meetings: CrmMeeting[]
  deals: CrmDeal[]
  payments: CrmPayment[]
}): LeadTotals {
  const liveDeals = input.deals.filter((d) => d.status !== 'canceled')
  const paid = input.payments.filter((p) => p.status === 1)
  return {
    calls: input.calls.length,
    connected: input.calls.filter(callConnected).length,
    openFollowups: input.followups.filter((f) => f.followup_status !== '2').length,
    meetings: input.meetings.length,
    scheduledMeetings: input.meetings.filter((m) => m.meeting_status === 'scheduled').length,
    deals: input.deals.length,
    dealValue: liveDeals.reduce((s, d) => s + d.deal_amount, 0),
    balance: liveDeals.reduce((s, d) => s + Math.max(0, d.balance_amount), 0),
    payments: paid.filter((p) => p.kind !== 'refund').length,
    received: paid.reduce((s, p) => s + (p.kind === 'refund' ? -p.amount : p.amount), 0),
  }
}
