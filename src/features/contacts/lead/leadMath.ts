import type { CrmCallLog, CrmDeal, CrmFollowup, CrmMeeting, CrmPayment } from '@/api/crmApi'
import { isOverdue } from '@/features/meetings/meetingUi'

// Numbers and the "next step" for one lead's page, worked out from the lists the page already loads.

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

export type NextStepAction = 'call' | 'meeting' | 'payment' | 'followup'

export interface NextStep {
  tone: 'urgent' | 'today' | 'later' | 'idle'
  /** Short label above the line, e.g. "Overdue follow-up". */
  kind: string
  /** The time or amount, set large. */
  headline: string
  detail?: string
  action: NextStepAction
  actionLabel: string
  /** Set for a meeting, so the button can open it. */
  meetingId?: string
}

/**
 * The single most useful thing to do with this lead now, in this order: an overdue follow-up, a meeting
 * that passed without being marked done, a meeting or follow-up due today, money still to collect, the
 * next thing booked, and finally "nothing planned".
 */
export function nextStep(input: { followups: CrmFollowup[]; meetings: CrmMeeting[]; deals: CrmDeal[] }, now = new Date()): NextStep {
  const open = input.followups
    .filter((f) => f.followup_status !== '2')
    .map((f) => ({ f, at: followupInstant(f) }))
    .filter((x): x is { f: CrmFollowup; at: Date } => x.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  const scheduled = input.meetings
    .filter((m) => m.meeting_status === 'scheduled')
    .sort((a, b) => new Date(a.meeting_time).getTime() - new Date(b.meeting_time).getTime())

  const overdueFollowup = open.find((x) => x.at.getTime() < now.getTime())
  if (overdueFollowup) {
    return {
      tone: 'urgent',
      kind: 'Overdue follow-up',
      headline: whenLabel(overdueFollowup.at, now),
      detail: overdueFollowup.f.note || 'The client is waiting for your call.',
      action: 'call',
      actionLabel: 'Call now',
    }
  }

  const missedMeeting = scheduled.find((m) => isOverdue(m, now.getTime()))
  if (missedMeeting) {
    return {
      tone: 'urgent',
      kind: 'Meeting not marked done',
      headline: whenLabel(new Date(missedMeeting.meeting_time), now),
      detail: 'Mark it done or reschedule it.',
      action: 'meeting',
      actionLabel: 'Open meeting',
      meetingId: missedMeeting.id,
    }
  }

  const upcomingMeeting = scheduled.find((m) => new Date(m.meeting_time).getTime() >= now.getTime())
  if (upcomingMeeting && sameDay(new Date(upcomingMeeting.meeting_time), now)) {
    return {
      tone: 'today',
      kind: 'Meeting today',
      headline: whenLabel(new Date(upcomingMeeting.meeting_time), now),
      detail: upcomingMeeting.meeting_summary || upcomingMeeting.meeting_type || undefined,
      action: 'meeting',
      actionLabel: 'Open meeting',
      meetingId: upcomingMeeting.id,
    }
  }

  const nextFollowup = open[0]
  if (nextFollowup && sameDay(nextFollowup.at, now)) {
    return {
      tone: 'today',
      kind: 'Follow-up today',
      headline: whenLabel(nextFollowup.at, now),
      detail: nextFollowup.f.note || undefined,
      action: 'call',
      actionLabel: 'Call now',
    }
  }

  const owing = input.deals.filter((d) => d.status !== 'canceled' && d.balance_amount > 0)
  if (owing.length > 0) {
    const total = owing.reduce((s, d) => s + d.balance_amount, 0)
    return {
      tone: 'today',
      kind: 'Payment to collect',
      headline: formatRupees(total),
      detail: owing.length === 1 ? `Left on “${owing[0].deal_name}”.` : `Left across ${owing.length} deals.`,
      action: 'payment',
      actionLabel: 'Add payment',
    }
  }

  const later = [
    ...(upcomingMeeting ? [{ at: new Date(upcomingMeeting.meeting_time), meeting: upcomingMeeting }] : []),
    ...(nextFollowup ? [{ at: nextFollowup.at, meeting: null }] : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime())[0]
  if (later) {
    return later.meeting
      ? { tone: 'later', kind: 'Next meeting', headline: whenLabel(later.at, now), action: 'meeting', actionLabel: 'Open meeting', meetingId: later.meeting.id }
      : { tone: 'later', kind: 'Next follow-up', headline: whenLabel(later.at, now), action: 'call', actionLabel: 'Call now' }
  }

  return {
    tone: 'idle',
    kind: 'Nothing planned',
    headline: 'No follow-up booked',
    detail: 'Book one so this lead isn’t forgotten.',
    action: 'followup',
    actionLabel: 'Add follow-up',
  }
}
