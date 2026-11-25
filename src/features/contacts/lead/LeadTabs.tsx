import { useState, type ReactNode } from 'react'
import { BellRing, CalendarClock, Check, Clock, Handshake, IndianRupee, MessageSquareText, Pencil, Phone, PhoneCall, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import type { CrmActivityEntry, CrmCallLog, CrmDeal, CrmFollowup, CrmMeeting, CrmPayment } from '@/api/crmApi'
import { MeetingCard } from '@/features/meetings/MeetingCard'
import { CompleteFollowupDialog, RescheduleFollowupDialog } from '@/features/followups/FollowupDialogs'
import { DealPaymentBadge, DealPaymentSummary } from '@/features/payments/DealPaymentSummary'
import { formatDate, formatDateTime } from '@/lib/dateFormat'
import { formatDate as formatIstDate, formatTime as formatIstTime } from '@/lib/followupFormat'
import { cn, formatTalkTime } from '@/lib/utils'
import { DEAL_STATUS_LABEL, KIND_COLOR } from './leadConstants'
import { callConnected, followupInstant, formatRupees, whenLabel } from './leadMath'

// What each tab of a lead's page shows. Lists are newest first; every list has its own "add" button so the
// tab works on its own, not only through the quick-add row.

/* ---------------- shared bits ---------------- */

function Card({ title, icon: Icon, color, action, children, className }: { title: string; icon: typeof Phone; color: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-h)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
            <Icon size={14} />
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-8 shrink-0 rounded-lg px-2 text-[13px] font-medium text-[var(--accent-strong)] hover:bg-[var(--accent-bg)]">
      {children}
    </button>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--accent-strong)]"
    >
      <Plus size={15} /> {children}
    </button>
  )
}

function Empty({ icon: Icon, text }: { icon: typeof Phone; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-4 py-8 text-center">
      <Icon size={20} className="text-[var(--text-muted)]" />
      <p className="text-[13px] text-[var(--text-muted)]">{text}</p>
    </div>
  )
}

function TabHead({ count, noun, action }: { count: number; noun: string; action: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-[13px] text-[var(--text-muted)]">
        <span className="font-mono-num text-[var(--text-h)]">{count}</span> {noun}
      </p>
      {action}
    </div>
  )
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/* ---------------- Overview ---------------- */

interface OverviewTabProps {
  calls: CrmCallLog[]
  meetings: CrmMeeting[]
  deals: CrmDeal[]
  discussions: CrmActivityEntry[]
  statusName: (id: string | null) => string | null
  onCall?: () => void
  onOpenTab: (tab: 'calls' | 'meeting' | 'deal') => void
  onScheduleMeeting: () => void
  onAddDeal: () => void
  onAddPayment: () => void
  onNote: () => void
  loading: boolean
}

export function OverviewTab({ calls, meetings, deals, discussions, statusName, onCall, onOpenTab, onScheduleMeeting, onAddDeal, onAddPayment, onNote, loading }: OverviewTabProps) {
  const lastCall = calls[0]
  const [now] = useState(() => Date.now())
  const nextMeeting = meetings
    .filter((m) => m.meeting_status === 'scheduled' && new Date(m.meeting_time).getTime() >= now)
    .sort((a, b) => new Date(a.meeting_time).getTime() - new Date(b.meeting_time).getTime())[0]
  const lastHeld = meetings.find((m) => m.meeting_status === 'completed')
  const liveDeals = deals.filter((d) => d.status !== 'canceled')
  const dealValue = liveDeals.reduce((s, d) => s + d.deal_amount, 0)
  const received = liveDeals.reduce((s, d) => s + d.net_paid_amount, 0)
  const balance = liveDeals.reduce((s, d) => s + Math.max(0, d.balance_amount), 0)

  if (loading) return <PageLoader />

  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-4">
      <Card title="Last call" icon={PhoneCall} color={KIND_COLOR.call} action={calls.length > 0 && <LinkButton onClick={() => onOpenTab('calls')}>Call log</LinkButton>}>
        {!lastCall ? (
          <p className="text-[13px] text-[var(--text-muted)]">No calls yet. The first call shows up here.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={callConnected(lastCall) ? 'success' : 'error'}>{callConnected(lastCall) ? 'Connected' : 'Not connected'}</Badge>
              <span className="text-[12px] text-[var(--text-muted)]">{whenLabel(new Date(lastCall.occurred_at))}</span>
            </div>
            {lastCall.remark ? <p className="text-[13.5px] text-[var(--text-h)]">{lastCall.remark}</p> : <p className="text-[13px] italic text-[var(--text-muted)]">No remark left.</p>}
            {statusName(lastCall.lead_status_id) && <p className="text-[12px] text-[var(--text-muted)]">Status set to {statusName(lastCall.lead_status_id)}</p>}
            <p className="text-[12px] text-[var(--text-muted)]">
              {calls.length} call{calls.length === 1 ? '' : 's'} · {calls.filter(callConnected).length} connected
            </p>
          </div>
        )}
        {onCall && (
          <button
            type="button"
            onClick={onCall}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-[13.5px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
          >
            <Phone size={14} /> Call now
          </button>
        )}
      </Card>

      <Card
        title="Meeting"
        icon={CalendarClock}
        color={KIND_COLOR.meeting}
        action={
          <span className="flex gap-1">
            {meetings.length > 0 && <LinkButton onClick={() => onOpenTab('meeting')}>View</LinkButton>}
            <LinkButton onClick={onScheduleMeeting}>Schedule</LinkButton>
          </span>
        }
      >
        {nextMeeting ? (
          <div className="space-y-1">
            <p className="font-display text-[17px] font-semibold text-[var(--text-h)]">{whenLabel(new Date(nextMeeting.meeting_time))}</p>
            {(nextMeeting.meeting_type || nextMeeting.meeting_summary) && (
              <p className="line-clamp-2 text-[13px] text-[var(--text-muted)]">{[nextMeeting.meeting_type, nextMeeting.meeting_summary].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--text-muted)]">No meeting scheduled.</p>
        )}
        {lastHeld && <p className="mt-2 text-[12px] text-[var(--text-muted)]">Last held {formatDateTime(lastHeld.meeting_time)}</p>}
      </Card>

      <Card
        title="Deals & money"
        icon={Handshake}
        color={KIND_COLOR.deal}
        action={
          <span className="flex gap-1">
            {deals.length > 0 && <LinkButton onClick={() => onOpenTab('deal')}>View</LinkButton>}
            <LinkButton onClick={onAddDeal}>New deal</LinkButton>
          </span>
        }
      >
        {liveDeals.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">No deal yet. Add one when the client agrees to buy.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2">
              {[
                { label: 'Deal value', value: dealValue, tone: 'text-[var(--text-h)]' },
                { label: 'Received', value: received, tone: 'text-[var(--success)]' },
                { label: 'Balance', value: balance, tone: balance > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-h)]' },
              ].map((x) => (
                <div key={x.label} className="rounded-lg bg-[var(--bg)] px-2.5 py-2">
                  <dt className="text-[11px] text-[var(--text-muted)]">{x.label}</dt>
                  <dd className={cn('font-mono-num truncate text-[14px] font-semibold', x.tone)}>{formatRupees(x.value)}</dd>
                </div>
              ))}
            </dl>
            {balance > 0 && (
              <button type="button" onClick={onAddPayment} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-[13.5px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]">
                <IndianRupee size={14} /> Add payment
              </button>
            )}
          </>
        )}
      </Card>

      <Card title="Discussion" icon={MessageSquareText} color={KIND_COLOR.note} action={<LinkButton onClick={onNote}>Add note</LinkButton>}>
        {discussions.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">No notes yet. Write what the client said so the next caller knows.</p>
        ) : (
          <ul className="space-y-2">
            {discussions.slice(0, 3).map((d) => (
              <li key={d.id} className="rounded-lg bg-[var(--bg)] px-3 py-2">
                <p className="whitespace-pre-wrap text-[13px] text-[var(--text-h)]">{d.summary.replace(/^Discussion updated:\s*/, '')}</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{whenLabel(new Date(d.created_at))}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* ---------------- Calls ---------------- */

export function CallsTab({ calls, loading, statusName }: { calls: CrmCallLog[]; loading: boolean; statusName: (id: string | null) => string | null }) {
  if (loading) return <PageLoader />
  if (calls.length === 0) return <Empty icon={PhoneCall} text="No calls logged for this lead yet." />
  return (
    <ul className="space-y-2">
      {calls.map((log) => {
        const ok = callConnected(log)
        const status = statusName(log.lead_status_id)
        return (
          <li key={log.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Badge tone={ok ? 'success' : 'error'}>{ok ? 'Connected' : 'Not connected'}</Badge>
                {log.source === 'device_sync' && <Badge tone="neutral">From phone</Badge>}
              </span>
              <span className="font-mono-num text-[12px] text-[var(--text-muted)]">
                {formatDate(log.occurred_at)} · {timeOf(log.occurred_at)}
              </span>
            </div>
            {log.remark && <p className="mt-1.5 text-[13.5px] text-[var(--text-h)]">{log.remark}</p>}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[var(--text-muted)]">
              {log.reason && <span>Reason: {log.reason}</span>}
              {status && <span>Status: {status}</span>}
              {log.duration_seconds ? <span>Talk time {formatTalkTime(log.duration_seconds)}</span> : null}
              {log.followup_date && (
                <span>
                  Next follow-up {formatIstDate(log.followup_date)}
                  {log.followup_time ? ` · ${formatIstTime(log.followup_time)}` : ''}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------- Follow-ups ---------------- */

export function FollowupsTab({ followups, onAdd }: { followups: CrmFollowup[]; onAdd: () => void }) {
  const [completing, setCompleting] = useState<CrmFollowup | null>(null)
  const [rescheduling, setRescheduling] = useState<CrmFollowup | null>(null)
  const [now] = useState(() => Date.now())
  const sorted = [...followups].sort((a, b) => (followupInstant(a)?.getTime() ?? 0) - (followupInstant(b)?.getTime() ?? 0))

  return (
    <>
      <TabHead count={followups.length} noun={followups.length === 1 ? 'open follow-up' : 'open follow-ups'} action={<AddButton onClick={onAdd}>Follow-up</AddButton>} />
      {sorted.length === 0 ? (
        <Empty icon={BellRing} text="No open follow-ups. Book one so this client gets a call back." />
      ) : (
        <ul className="space-y-2">
          {sorted.map((f) => {
            const at = followupInstant(f)
            const overdue = at !== null && at.getTime() < now
            return (
              <li key={f.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] font-semibold text-[var(--text-h)]">{at ? whenLabel(at) : formatIstDate(f.followup_date)}</span>
                    {overdue && <Badge tone="error">Overdue</Badge>}
                  </p>
                  {f.note && <p className="mt-1 text-[13px] text-[var(--text)]">{f.note}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRescheduling(f)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-4 text-[13px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)] sm:flex-none">
                    <Clock size={14} /> Reschedule
                  </button>
                  <button type="button" onClick={() => setCompleting(f)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--success)] px-4 text-[13px] font-semibold text-[var(--ink)] hover:brightness-110 sm:flex-none">
                    <Check size={14} /> Complete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <CompleteFollowupDialog followup={completing} onClose={() => setCompleting(null)} />
      <RescheduleFollowupDialog followup={rescheduling} onClose={() => setRescheduling(null)} />
    </>
  )
}

/* ---------------- Meetings ---------------- */

export function MeetingsTab({ meetings, loading, userId, isAdmin, onAdd, onOpen }: { meetings: CrmMeeting[]; loading: boolean; userId: string; isAdmin: boolean; onAdd: () => void; onOpen: (id: string) => void }) {
  return (
    <>
      <TabHead count={meetings.length} noun={meetings.length === 1 ? 'meeting' : 'meetings'} action={<AddButton onClick={onAdd}>Meeting</AddButton>} />
      {loading ? (
        <PageLoader />
      ) : meetings.length === 0 ? (
        <Empty icon={CalendarClock} text="No meetings with this client yet." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} userId={userId} isAdmin={isAdmin} onOpen={() => onOpen(m.id)} />
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------- Deals ---------------- */

const DEAL_TONE = { created: 'accent', accepted: 'success', canceled: 'error' } as const

export function DealsTab({ deals, loading, onAdd, onEdit, onPay }: { deals: CrmDeal[]; loading: boolean; onAdd: () => void; onEdit: (deal: CrmDeal) => void; onPay: () => void }) {
  return (
    <>
      <TabHead count={deals.length} noun={deals.length === 1 ? 'deal' : 'deals'} action={<AddButton onClick={onAdd}>Deal</AddButton>} />
      {loading ? (
        <PageLoader />
      ) : deals.length === 0 ? (
        <Empty icon={Handshake} text="No deals yet. Add one when the client is ready to buy." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {deals.map((deal) => (
            <li key={deal.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-[14.5px] font-semibold text-[var(--text-h)]">{deal.deal_name}</p>
                  {deal.product_name && <p className="text-[12px] text-[var(--text-muted)]">{deal.product_name}</p>}
                </div>
                <button type="button" onClick={() => onEdit(deal)} aria-label="Edit deal" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
                  <Pencil size={14} />
                </button>
              </div>
              <p className="mt-1.5 font-mono-num text-[18px] font-semibold text-[var(--text-h)]">{formatRupees(deal.deal_amount)}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone={DEAL_TONE[deal.status]}>{DEAL_STATUS_LABEL[deal.status]}</Badge>
                {deal.status !== 'canceled' && <DealPaymentBadge status={deal.payment_status} />}
              </div>
              <DealPaymentSummary deal={deal} />
              {deal.deal_details && <p className="mt-1.5 text-[12.5px] text-[var(--text)]">{deal.deal_details}</p>}
              {deal.status !== 'canceled' && deal.balance_amount > 0 && (
                <button type="button" onClick={onPay} className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-[13px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]">
                  <IndianRupee size={13} /> Add payment
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ---------------- Payments ---------------- */

export function PaymentsTab({ payments, loading, onAdd }: { payments: CrmPayment[]; loading: boolean; onAdd: () => void }) {
  return (
    <>
      <TabHead count={payments.length} noun={payments.length === 1 ? 'entry' : 'entries'} action={<AddButton onClick={onAdd}>Payment</AddButton>} />
      {loading ? (
        <PageLoader />
      ) : payments.length === 0 ? (
        <Empty icon={IndianRupee} text="No money received from this client yet." />
      ) : (
        <ul className="space-y-2">
          {payments.map((p) => {
            const refund = p.kind === 'refund'
            return (
              <li key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="min-w-0">
                  <p className={cn('font-mono-num text-[16px] font-semibold', refund ? 'text-[var(--error)]' : 'text-[var(--text-h)]')}>
                    {refund ? '−' : ''}
                    {p.currency === 'INR' ? formatRupees(p.amount) : `${p.currency} ${p.amount.toLocaleString()}`}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {p.mop}
                    {p.payment_date ? ` · ${formatDate(p.payment_date, 'UTC')}` : ''}
                    {p.subscription_name ? ` · ${p.subscription_name}` : ''}
                  </p>
                  {p.notes && <p className="mt-1 text-[12.5px] text-[var(--text)]">{p.notes}</p>}
                </div>
                {refund ? <Badge tone="error">Refund</Badge> : <Badge tone={p.status === 1 ? 'success' : 'warning'}>{p.status === 1 ? 'Paid' : 'Voided'}</Badge>}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
