import { useState } from 'react'
import { Phone, Handshake, CalendarCheck, Wallet, Link as LinkIcon, Send, LayoutGrid, Plus, X, Pencil } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useCallLead } from '@/features/calling/useCallLead'
import {
  useCallLogsForLead,
  useLeadStatuses,
  useLeadStageTypes,
  useMeetings,
  useDeals,
  usePayments,
  useUpdateLead,
  useLeadActivity,
  useCreateDeal,
  useUpdateDeal,
  useCreateMeeting,
  useUpdateMeeting,
  useCreatePayment,
  useUpdatePayment,
} from '@/api/queries'
import { STATUS_LABEL, STATUS_TONE, formatDate, formatTime } from '@/lib/followupFormat'
import type { MeetingStatus, DealStatus, CrmDeal, CrmMeeting, CrmPayment } from '@/api/crmApi'

const MOP_OPTIONS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']

function todayDateInput() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, in the viewer's local calendar day
}

const MEETING_STATUS_TONE: Record<MeetingStatus, 'accent' | 'success' | 'error'> = {
  scheduled: 'accent',
  completed: 'success',
  cancelled: 'error',
}

const DEAL_STATUS_TONE: Record<DealStatus, 'success' | 'error' | 'accent'> = {
  accepted: 'success',
  canceled: 'error',
  created: 'accent',
}

function formatMeetingWhen(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function stripDiscussionPrefix(summary: string) {
  return summary.replace(/^Discussion updated:\s*/, '')
}

const DEAL_STATUS_OPTIONS: DealStatus[] = ['created', 'accepted', 'canceled']
const MEETING_STATUS_OPTIONS: MeetingStatus[] = ['scheduled', 'completed', 'cancelled']

export type ContactDetailTab = 'overview' | 'deal' | 'meeting' | 'payment'
type Tab = ContactDetailTab
export const CONTACT_DETAIL_TABS: ContactDetailTab[] = ['overview', 'deal', 'meeting', 'payment']

export interface ContactDetailViewProps {
  contactId: string
  leadId: string | null
  contactName: string | null
  contactPhone: string | null
  followupDate?: string | null
  followupTime?: string | null
  followupStatus?: '0' | '1' | '2' | null
  /** Current owner; `null` means unassigned, so calling claims it. Omit when the lead is known to be yours. */
  assignToStaffId?: string | null
  /** Tab to open on, e.g. 'deal' when coming from a Deals card. */
  initialTab?: ContactDetailTab
}

// Shared body for both "Follow-up Details" (a specific due follow-up) and
// "Contact Details" (any contact/lead, opened from the Contacts list) — the
// two pages differ only in how they resolve these props and what their back
// button/header say; everything below (Last Discussion, Discussion, Deal /
// Meeting / Payment tabs, the discussion composer) is identical.
export function ContactDetailView({
  contactId,
  leadId,
  contactName,
  contactPhone,
  followupDate,
  followupTime,
  followupStatus,
  assignToStaffId,
  initialTab = 'overview',
}: ContactDetailViewProps) {
  const { startCall, assignToMe, isClaiming } = useCallLead()
  const { data: callLogs = [], isLoading: isLoadingLogs } = useCallLogsForLead(leadId)
  const { data: leadStatuses = [] } = useLeadStatuses()
  const { data: stageTypes = [] } = useLeadStageTypes()
  const { data: allMeetings = [], isLoading: isLoadingMeetings } = useMeetings()
  const { data: dealsData, isLoading: isLoadingDeals } = useDeals()
  const { data: paymentsData, isLoading: isLoadingPayments } = usePayments()
  const { data: leadActivity = [], isLoading: isLoadingActivity } = useLeadActivity(leadId)
  const updateLead = useUpdateLead()
  const createDeal = useCreateDeal()
  const updateDeal = useUpdateDeal()
  const createMeeting = useCreateMeeting()
  const updateMeeting = useUpdateMeeting()
  const createPayment = useCreatePayment()
  const updatePayment = useUpdatePayment()
  const { show } = useToast()
  const [discussionDraft, setDiscussionDraft] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  const [dealFormOpen, setDealFormOpen] = useState(false)
  const [dealName, setDealName] = useState('')
  const [dealAmount, setDealAmount] = useState('')
  const [dealDetails, setDealDetails] = useState('')

  const [meetingFormOpen, setMeetingFormOpen] = useState(false)
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [meetingSummary, setMeetingSummary] = useState('')
  const [meetingPricing, setMeetingPricing] = useState('')

  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState('INR')
  const [paymentMop, setPaymentMop] = useState(MOP_OPTIONS[0])
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayDateInput())

  const [editingDealId, setEditingDealId] = useState<string | null>(null)
  const [editDealName, setEditDealName] = useState('')
  const [editDealAmount, setEditDealAmount] = useState('')
  const [editDealDetails, setEditDealDetails] = useState('')
  const [editDealStatus, setEditDealStatus] = useState<DealStatus>('created')

  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const [editMeetingTime, setEditMeetingTime] = useState('')
  const [editMeetingStatus, setEditMeetingStatus] = useState<MeetingStatus>('scheduled')
  const [editMeetingLink, setEditMeetingLink] = useState('')
  const [editMeetingPricing, setEditMeetingPricing] = useState('')
  const [editMeetingSummary, setEditMeetingSummary] = useState('')

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentStatus, setEditPaymentStatus] = useState<0 | 1>(1)

  const [lastCall, ...earlierCalls] = callLogs
  const meetings = allMeetings
    .filter((m) => m.contact_id === contactId)
    .sort((a, b) => new Date(b.meeting_time).getTime() - new Date(a.meeting_time).getTime())
  const deals = (dealsData?.deals ?? [])
    .filter((d) => d.contact_id === contactId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const payments = (paymentsData?.payments ?? [])
    .filter((p) => p.contact_id === contactId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const discussionEntries = leadActivity.filter((a) => a.kind === 'discussion')

  function saveDiscussion() {
    if (!leadId || !discussionDraft.trim()) return
    updateLead.mutate(
      { id: leadId, patch: { discussion: discussionDraft } },
      {
        onSuccess: () => {
          show({ title: 'Discussion saved', tone: 'success' })
          setDiscussionDraft('')
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to save discussion', tone: 'error' }),
      },
    )
  }

  function submitDeal() {
    if (!dealName.trim() || !dealAmount) return
    createDeal.mutate(
      { contactId, dealName: dealName.trim(), dealAmount: Number(dealAmount), dealDetails: dealDetails.trim() || undefined },
      {
        onSuccess: () => {
          show({ title: 'Deal added', tone: 'success' })
          setDealName('')
          setDealAmount('')
          setDealDetails('')
          setDealFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to add deal', tone: 'error' }),
      },
    )
  }

  function submitMeeting() {
    if (!meetingTime) return
    createMeeting.mutate(
      {
        contactId,
        meetingTime,
        meetingType: meetingType.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        meetingSummary: meetingSummary.trim() || undefined,
        pricing: meetingPricing ? Number(meetingPricing) : undefined,
      },
      {
        onSuccess: () => {
          show({ title: 'Meeting scheduled', tone: 'success' })
          setMeetingTime('')
          setMeetingType('')
          setMeetingLink('')
          setMeetingSummary('')
          setMeetingPricing('')
          setMeetingFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to schedule meeting', tone: 'error' }),
      },
    )
  }

  function submitPayment() {
    if (!paymentAmount) return
    createPayment.mutate(
      {
        contactId,
        amount: Number(paymentAmount),
        currency: paymentCurrency,
        mop: paymentMop,
        notes: paymentNotes.trim() || undefined,
        paymentDate: paymentDate || undefined,
      },
      {
        onSuccess: () => {
          show({ title: 'Payment logged', tone: 'success' })
          setPaymentAmount('')
          setPaymentCurrency('INR')
          setPaymentMop(MOP_OPTIONS[0])
          setPaymentNotes('')
          setPaymentDate(todayDateInput())
          setPaymentFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to log payment', tone: 'error' }),
      },
    )
  }

  function startEditDeal(deal: CrmDeal) {
    setEditingDealId(deal.id)
    setEditDealName(deal.deal_name)
    setEditDealAmount(String(deal.deal_amount))
    setEditDealDetails(deal.deal_details ?? '')
    setEditDealStatus(deal.status)
  }

  function saveEditDeal() {
    if (!editingDealId || !editDealName.trim() || !editDealAmount) return
    updateDeal.mutate(
      {
        id: editingDealId,
        patch: { dealName: editDealName.trim(), dealAmount: Number(editDealAmount), dealDetails: editDealDetails.trim(), status: editDealStatus },
      },
      {
        onSuccess: () => {
          show({ title: 'Deal updated', tone: 'success' })
          setEditingDealId(null)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update deal', tone: 'error' }),
      },
    )
  }

  function startEditMeeting(meeting: CrmMeeting) {
    setEditingMeetingId(meeting.id)
    setEditMeetingTime(toDatetimeLocalValue(meeting.meeting_time))
    setEditMeetingStatus(meeting.meeting_status)
    setEditMeetingLink(meeting.meeting_link ?? '')
    setEditMeetingPricing(String(meeting.pricing ?? 0))
    setEditMeetingSummary(meeting.meeting_summary ?? '')
  }

  function saveEditMeeting() {
    if (!editingMeetingId || !editMeetingTime) return
    updateMeeting.mutate(
      {
        id: editingMeetingId,
        patch: {
          meetingTime: editMeetingTime,
          meetingStatus: editMeetingStatus,
          meetingLink: editMeetingLink.trim(),
          pricing: editMeetingPricing ? Number(editMeetingPricing) : 0,
          meetingSummary: editMeetingSummary.trim(),
        },
      },
      {
        onSuccess: () => {
          show({ title: 'Meeting updated', tone: 'success' })
          setEditingMeetingId(null)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update meeting', tone: 'error' }),
      },
    )
  }

  function startEditPayment(payment: CrmPayment) {
    setEditingPaymentId(payment.id)
    setEditPaymentAmount(String(payment.amount))
    setEditPaymentStatus(payment.status)
  }

  function saveEditPayment() {
    if (!editingPaymentId || !editPaymentAmount) return
    updatePayment.mutate(
      { id: editingPaymentId, patch: { amount: Number(editPaymentAmount), status: editPaymentStatus } },
      {
        onSuccess: () => {
          show({ title: 'Payment updated', tone: 'success' })
          setEditingPaymentId(null)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update payment', tone: 'error' }),
      },
    )
  }

  function stageAndStatusFor(leadStatusId: string | null) {
    if (!leadStatusId) return null
    const status = leadStatuses.find((s) => s.id === leadStatusId)
    if (!status) return null
    const stage = stageTypes.find((s) => s.id === status.stage_id)
    return { stage: stage?.lead_stage ?? null, status: status.lead_status }
  }

  return (
    <>
      <div className="mx-auto w-full max-w-lg flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <Avatar name={contactName ?? 'Unknown'} size={40} />
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-[var(--text-h)]">{contactName ?? 'Unknown'}</p>
              <p className="text-[13px] text-[var(--text-muted)]">{contactPhone ?? '—'}</p>
              {assignToStaffId === null && leadId && (
                <button
                  type="button"
                  onClick={() => assignToMe(leadId)}
                  disabled={isClaiming}
                  className="mt-0.5 text-[12px] font-semibold text-[var(--accent)] hover:underline disabled:opacity-60"
                >
                  Unassigned · Assign to me
                </button>
              )}
            </div>
            {contactPhone && (
              <button
                type="button"
                onClick={() => startCall({ leadId, phone: contactPhone, assignToStaffId })}
                disabled={isClaiming}
                aria-label={`Call ${contactPhone}`}
                title={`Call ${contactPhone}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
              >
                <Phone size={16} />
              </button>
            )}
          </div>
          {followupDate && (
            <p className="mt-3 text-[13px] text-[var(--text)]">
              Due {formatDate(followupDate)} · {followupTime ? formatTime(followupTime) : '—'}
            </p>
          )}
          {followupStatus && (
            <div className="mt-2">
              <Badge tone={STATUS_TONE[followupStatus]}>{STATUS_LABEL[followupStatus]}</Badge>
            </div>
          )}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Button
              variant={activeTab === 'overview' ? 'primary' : 'outline'}
              size="sm"
              className="justify-center px-2"
              onClick={() => setActiveTab('overview')}
            >
              <LayoutGrid size={14} />
            </Button>
            <Button
              variant={activeTab === 'deal' ? 'primary' : 'outline'}
              size="sm"
              className="justify-center px-2"
              onClick={() => setActiveTab('deal')}
            >
              <Handshake size={14} /> Deal
            </Button>
            <Button
              variant={activeTab === 'meeting' ? 'primary' : 'outline'}
              size="sm"
              className="justify-center px-2"
              onClick={() => setActiveTab('meeting')}
            >
              <CalendarCheck size={14} /> Meeting
            </Button>
            <Button
              variant={activeTab === 'payment' ? 'primary' : 'outline'}
              size="sm"
              className="justify-center px-2"
              onClick={() => setActiveTab('payment')}
            >
              <Wallet size={14} /> Payment
            </Button>
          </div>
        </div>

      {activeTab === 'overview' && (
        <>
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Last Discussion</p>
          {isLoadingLogs ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : !lastCall ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">No previous calls logged for this lead yet.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge tone={lastCall.outcome === 'connected' ? 'success' : 'error'}>
                  {lastCall.outcome === 'connected' ? 'Connected' : 'Not Connected'}
                </Badge>
                <span className="text-[11.5px] text-[var(--text-muted)]">{new Date(lastCall.created_at).toLocaleString()}</span>
              </div>
              {lastCall.reason && <p className="text-[12.5px] text-[var(--text-muted)]">Reason: {lastCall.reason}</p>}
              {lastCall.remark ? (
                <p className="text-[13px] text-[var(--text)]">{lastCall.remark}</p>
              ) : (
                <p className="text-[13px] italic text-[var(--text-muted)]">No remark left.</p>
              )}
              {lastCall.duration_seconds !== null && (
                <p className="text-[11.5px] text-[var(--text-muted)]">Duration: {lastCall.duration_seconds}s</p>
              )}
              {(() => {
                const info = stageAndStatusFor(lastCall.lead_status_id)
                return info ? (
                  <p className="text-[12.5px] text-[var(--text-muted)]">
                    Stage: <span className="font-medium text-[var(--text)]">{info.stage ?? '—'}</span> · Status:{' '}
                    <span className="font-medium text-[var(--text)]">{info.status}</span>
                  </p>
                ) : null
              })()}
              {lastCall.followup_date && (
                <p className="text-[12.5px] text-[var(--text-muted)]">
                  Next follow-up: {formatDate(lastCall.followup_date)}
                  {lastCall.followup_time ? ` · ${formatTime(lastCall.followup_time)}` : ''}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] p-4">
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Discussion</p>
          {isLoadingActivity ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : discussionEntries.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">No discussion added yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {discussionEntries.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--text)]">{stripDiscussionPrefix(entry.summary)}</p>
                  <p className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {earlierCalls.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="text-[13px] font-semibold text-[var(--text-h)]">Earlier Calls</p>
            <div className="mt-2 space-y-2">
              {earlierCalls.map((log) => (
                <div key={log.id} className="rounded-lg border border-[var(--border)] p-2.5">
                  <div className="flex items-center justify-between">
                    <Badge tone={log.outcome === 'connected' ? 'success' : 'error'}>
                      {log.outcome === 'connected' ? 'Connected' : 'Not Connected'}
                    </Badge>
                    <span className="text-[11px] text-[var(--text-muted)]">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  {log.remark && <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{log.remark}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      )}

      {activeTab === 'deal' && (
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[var(--text-h)]">Deals</p>
            <Button size="sm" variant={dealFormOpen ? 'secondary' : 'primary'} onClick={() => setDealFormOpen((v) => !v)}>
              {dealFormOpen ? <X size={14} /> : <Plus size={14} />}
              {dealFormOpen ? 'Close' : 'Create Deal'}
            </Button>
          </div>
          {dealFormOpen && (
            <div className="mt-2 space-y-3 rounded-lg border border-[var(--border)] p-3">
              <Field label="Deal name">
                <Input value={dealName} onChange={(e) => setDealName(e.target.value)} placeholder="e.g. Annual plan upgrade" />
              </Field>
              <Field label="Amount">
                <Input type="number" inputMode="decimal" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Details" hint="Optional">
                <Textarea value={dealDetails} onChange={(e) => setDealDetails(e.target.value)} rows={2} placeholder="Notes about this deal…" />
              </Field>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setDealFormOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={submitDeal}
                  disabled={!dealName.trim() || !dealAmount || createDeal.isPending}
                >
                  {createDeal.isPending ? 'Saving…' : 'Save Deal'}
                </Button>
              </div>
            </div>
          )}
          {isLoadingDeals ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : deals.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">No deals for this contact yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {deals.map((deal) =>
                editingDealId === deal.id ? (
                  <div key={deal.id} className="space-y-3 rounded-lg border border-[var(--border)] p-2.5">
                    <Field label="Deal name">
                      <Input value={editDealName} onChange={(e) => setEditDealName(e.target.value)} />
                    </Field>
                    <Field label="Amount">
                      <Input type="number" inputMode="decimal" value={editDealAmount} onChange={(e) => setEditDealAmount(e.target.value)} />
                    </Field>
                    <Field label="Status">
                      <select
                        value={editDealStatus}
                        onChange={(e) => setEditDealStatus(e.target.value as DealStatus)}
                        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
                      >
                        {DEAL_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Details" hint="Optional">
                      <Textarea value={editDealDetails} onChange={(e) => setEditDealDetails(e.target.value)} rows={2} />
                    </Field>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setEditingDealId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 justify-center"
                        onClick={saveEditDeal}
                        disabled={!editDealName.trim() || !editDealAmount || updateDeal.isPending}
                      >
                        {updateDeal.isPending ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={deal.id} className="rounded-lg border border-[var(--border)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-semibold text-[var(--text-h)]">
                        <span className="font-normal text-[var(--text-muted)]">Deal name: </span>
                        {deal.deal_name}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={DEAL_STATUS_TONE[deal.status]}>Status: {deal.status}</Badge>
                        <button
                          onClick={() => startEditDeal(deal)}
                          title="Edit deal"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--accent-strong)]">
                      <span className="text-[12px] font-normal text-[var(--text-muted)]">Amount: </span>
                      Rs. <span className="font-mono-num">{formatMoney(deal.deal_amount)}</span>
                    </p>
                    {deal.deal_details && (
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        <span className="text-[var(--text-muted)]">Details: </span>
                        {deal.deal_details}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'meeting' && (
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[var(--text-h)]">Meetings</p>
            <Button size="sm" variant={meetingFormOpen ? 'secondary' : 'primary'} onClick={() => setMeetingFormOpen((v) => !v)}>
              {meetingFormOpen ? <X size={14} /> : <Plus size={14} />}
              {meetingFormOpen ? 'Close' : 'Create Meeting'}
            </Button>
          </div>
          {meetingFormOpen && (
            <div className="mt-2 space-y-3 rounded-lg border border-[var(--border)] p-3">
              <Field label="Date & time">
                <Input type="datetime-local" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
              </Field>
              <Field label="Type" hint="Optional — e.g. Demo, Follow-up call">
                <Input value={meetingType} onChange={(e) => setMeetingType(e.target.value)} placeholder="Demo" />
              </Field>
              <Field label="Meeting link" hint="Optional">
                <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/…" />
              </Field>
              <Field label="Pricing" hint="Optional">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={meetingPricing}
                  onChange={(e) => setMeetingPricing(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Summary" hint="Optional">
                <Textarea value={meetingSummary} onChange={(e) => setMeetingSummary(e.target.value)} rows={2} placeholder="Agenda or notes…" />
              </Field>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setMeetingFormOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={submitMeeting}
                  disabled={!meetingTime || createMeeting.isPending}
                >
                  {createMeeting.isPending ? 'Saving…' : 'Schedule Meeting'}
                </Button>
              </div>
            </div>
          )}
          {isLoadingMeetings ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : meetings.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">No meetings scheduled for this contact yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {meetings.map((meeting) =>
                editingMeetingId === meeting.id ? (
                  <div key={meeting.id} className="space-y-3 rounded-lg border border-[var(--border)] p-2.5">
                    <Field label="Date & time">
                      <Input type="datetime-local" value={editMeetingTime} onChange={(e) => setEditMeetingTime(e.target.value)} />
                    </Field>
                    <Field label="Status">
                      <select
                        value={editMeetingStatus}
                        onChange={(e) => setEditMeetingStatus(e.target.value as MeetingStatus)}
                        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
                      >
                        {MEETING_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Meeting link" hint="Optional">
                      <Input value={editMeetingLink} onChange={(e) => setEditMeetingLink(e.target.value)} placeholder="https://meet.google.com/…" />
                    </Field>
                    <Field label="Pricing" hint="Optional">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={editMeetingPricing}
                        onChange={(e) => setEditMeetingPricing(e.target.value)}
                      />
                    </Field>
                    <Field label="Summary" hint="Optional">
                      <Textarea value={editMeetingSummary} onChange={(e) => setEditMeetingSummary(e.target.value)} rows={2} />
                    </Field>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setEditingMeetingId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 justify-center"
                        onClick={saveEditMeeting}
                        disabled={!editMeetingTime || updateMeeting.isPending}
                      >
                        {updateMeeting.isPending ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={meeting.id} className="rounded-lg border border-[var(--border)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-[12.5px] text-[var(--text)]">
                        <span className="font-sans text-[11px] text-[var(--text-muted)]">Scheduled meeting time: </span>
                        {formatMeetingWhen(meeting.meeting_time)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={MEETING_STATUS_TONE[meeting.meeting_status]}>{meeting.meeting_status}</Badge>
                        <button
                          onClick={() => startEditMeeting(meeting)}
                          title="Edit meeting"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                    {meeting.meeting_type && (
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        <span>Type: </span>
                        {meeting.meeting_type}
                      </p>
                    )}
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                      <span>Pricing: </span>
                      Rs. <span className="font-mono-num">{formatMoney(meeting.pricing)}</span>
                    </p>
                    {meeting.meeting_summary && (
                      <p className="mt-1 text-[12.5px] text-[var(--text)]">
                        <span className="text-[12px] text-[var(--text-muted)]">Summary: </span>
                        {meeting.meeting_summary}
                      </p>
                    )}
                    {meeting.meeting_link && (
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        <span>Link: </span>
                        <a
                          href={meeting.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--accent-strong)] hover:underline"
                        >
                          <LinkIcon size={11} /> Join link
                        </a>
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[var(--text-h)]">Payments</p>
            <Button size="sm" variant={paymentFormOpen ? 'secondary' : 'primary'} onClick={() => setPaymentFormOpen((v) => !v)}>
              {paymentFormOpen ? <X size={14} /> : <Plus size={14} />}
              {paymentFormOpen ? 'Close' : 'Create Payment'}
            </Button>
          </div>
          {paymentFormOpen && (
            <div className="mt-2 space-y-3 rounded-lg border border-[var(--border)] p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Currency">
                  <Input value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value.toUpperCase())} maxLength={3} />
                </Field>
              </div>
              <Field label="Payment date">
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </Field>
              <Field label="Payment method">
                <select
                  value={paymentMop}
                  onChange={(e) => setPaymentMop(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
                >
                  {MOP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notes" hint="Optional">
                <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={2} placeholder="Reference / notes…" />
              </Field>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setPaymentFormOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={submitPayment}
                  disabled={!paymentAmount || createPayment.isPending}
                >
                  {createPayment.isPending ? 'Saving…' : 'Save Payment'}
                </Button>
              </div>
            </div>
          )}
          {isLoadingPayments ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">No payments from this contact yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {payments.map((payment) =>
                editingPaymentId === payment.id ? (
                  <div key={payment.id} className="space-y-3 rounded-lg border border-[var(--border)] p-2.5">
                    <Field label="Amount">
                      <Input type="number" inputMode="decimal" value={editPaymentAmount} onChange={(e) => setEditPaymentAmount(e.target.value)} />
                    </Field>
                    <Field label="Status">
                      <select
                        value={editPaymentStatus}
                        onChange={(e) => setEditPaymentStatus(Number(e.target.value) as 0 | 1)}
                        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
                      >
                        <option value={1}>Paid</option>
                        <option value={0}>Pending</option>
                      </select>
                    </Field>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setEditingPaymentId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 justify-center"
                        onClick={saveEditPayment}
                        disabled={!editPaymentAmount || updatePayment.isPending}
                      >
                        {updatePayment.isPending ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={payment.id} className="rounded-lg border border-[var(--border)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-[var(--accent-strong)]">
                        <span className="text-[12px] font-normal text-[var(--text-muted)]">Amount: </span>
                        {payment.currency} <span className="font-mono-num">{formatMoney(payment.amount)}</span>
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={payment.status === 1 ? 'success' : 'warning'}>
                          Status: {payment.status === 1 ? 'Paid' : 'Pending'}
                        </Badge>
                        <button
                          onClick={() => startEditPayment(payment)}
                          title="Edit payment"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                      <span>Method: </span>
                      {payment.mop}
                    </p>
                    {payment.payment_date && (
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        <span>Payment date: </span>
                        {new Date(payment.payment_date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                      </p>
                    )}
                    {payment.notes && (
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        <span>Notes: </span>
                        {payment.notes}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {leadId && (
        <div className="mx-auto w-full max-w-lg shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              value={discussionDraft}
              onChange={(e) => setDiscussionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveDiscussion()
                }
              }}
              placeholder="Add a discussion…"
              className="h-10"
            />
            <button
              onClick={saveDiscussion}
              disabled={!discussionDraft.trim() || updateLead.isPending}
              title="Save"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
