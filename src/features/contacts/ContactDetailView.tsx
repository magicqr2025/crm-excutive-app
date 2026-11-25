import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Send, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { SendLeadEmailDialog } from '@/components/SendLeadEmailDialog'
import {
  useCallLogsForLead,
  useContactActiveFollowups,
  useDeals,
  useLead,
  useLeadActivity,
  useLeadStageTypes,
  useLeadStatuses,
  useMeetings,
  usePayments,
  useUpdateLead,
} from '@/api/queries'
import type { CrmDeal, CrmLead } from '@/api/crmApi'
import { useCallLead } from '@/features/calling/useCallLead'
import { LeadHistoryPanel } from '@/features/calling/LeadHistoryPanel'
import { DispositionForm } from '@/features/calling/DispositionForm'
import { FollowupCallForm } from '@/features/followups/FollowupCallForm'
import { STATUS_LABEL, STATUS_TONE, formatDate, formatTime } from '@/lib/followupFormat'
import { cn } from '@/lib/utils'
import { LeadHero } from './lead/LeadHero'
import { NextStepCard } from './lead/NextStepCard'
import { QuickAddRow, StatTiles } from './lead/LeadQuickBar'
import { LeadTabBar } from './lead/LeadTabBar'
import { LEAD_TABS, type LeadFormKind, type LeadTab } from './lead/leadConstants'
import { LeadDetailsPanel } from './lead/LeadDetailsPanel'
import { CallsTab, DealsTab, FollowupsTab, MeetingsTab, OverviewTab, PaymentsTab } from './lead/LeadTabs'
import { AddFollowupDialog, AddMeetingDialog, AddPaymentDialog, DealFormDialog, EditLeadDialog } from './lead/LeadForms'
import { leadTotals, nextStep } from './lead/leadMath'

export type ContactDetailTab = LeadTab
export const CONTACT_DETAIL_TABS: ContactDetailTab[] = LEAD_TABS

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
  /** Full lead record, when the page already has it; otherwise it is loaded from `leadId`. */
  lead?: CrmLead
  /** Set on a follow-up's own page: a call made here closes that follow-up. */
  followupId?: string
  /** Open with the call form already showing (the Call button on a Follow-ups card has just dialled). */
  openCallForm?: boolean
  /** Runs after the Call Status form is saved (the pipeline page moves on to the next lead). */
  onCallSaved?: () => void
}

/**
 * One client's page, shared by Contact Details, Follow-up Details and a pipeline's Lead Details.
 * Phone first: hero with Call, the next step, quick-add chips, five counts, then tabs; the details fold out
 * at the bottom. From a wide tablet (lg) up the details move into a left column.
 */
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
  lead: leadProp,
  followupId,
  openCallForm = false,
  onCallSaved,
}: ContactDetailViewProps) {
  const navigate = useNavigate()
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { startCall, assignToMe, isClaiming } = useCallLead()

  const { data: fetchedLead } = useLead(leadProp ? '' : (leadId ?? ''))
  const lead = leadProp ?? fetchedLead
  const { data: callLogs = [], isLoading: loadingCalls } = useCallLogsForLead(leadId)
  const { data: statuses = [] } = useLeadStatuses()
  const { data: stages = [] } = useLeadStageTypes()
  const { data: allMeetings = [], isLoading: loadingMeetings } = useMeetings(contactId)
  const { data: dealsData, isLoading: loadingDeals } = useDeals(contactId)
  const { data: paymentsData, isLoading: loadingPayments } = usePayments(contactId)
  const { data: activity = [] } = useLeadActivity(leadId)
  const { data: followups = [] } = useContactActiveFollowups(contactId)
  const updateLead = useUpdateLead()

  const [tab, setTab] = useState<LeadTab>(initialTab)
  const [form, setForm] = useState<LeadFormKind | null>(null)
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null)
  const [editLeadOpen, setEditLeadOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const noteRef = useRef<HTMLInputElement>(null)
  const callFormRef = useRef<HTMLDivElement>(null)
  // The Call Status form appears once the dialer opens for this lead.
  const [dialedLeadId, setDialedLeadId] = useState<string | null>(openCallForm ? leadId : null)

  const meetings = useMemo(
    () => allMeetings.filter((m) => m.contact_id === contactId).sort((a, b) => new Date(b.meeting_time).getTime() - new Date(a.meeting_time).getTime()),
    [allMeetings, contactId],
  )
  const deals = useMemo(
    () => (dealsData?.deals ?? []).filter((d) => d.contact_id === contactId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [dealsData, contactId],
  )
  const payments = useMemo(
    () => (paymentsData?.payments ?? []).filter((p) => p.contact_id === contactId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [paymentsData, contactId],
  )
  const discussions = activity.filter((a) => a.kind === 'discussion')
  const totals = leadTotals({ calls: callLogs, followups, meetings, deals, payments })
  const step = nextStep({ followups, meetings, deals })

  const status = lead ? (statuses.find((s) => s.id === lead.lead_status_id) ?? statuses.find((s) => s.lead_status === lead.lead_status)) : undefined
  const stageName = stages.find((s) => s.id === (status?.stage_id ?? lead?.lead_stage_id))?.lead_stage ?? null
  function statusName(id: string | null) {
    if (!id) return null
    const s = statuses.find((x) => x.id === id)
    if (!s) return null
    const st = stages.find((x) => x.id === s.stage_id)?.lead_stage
    return st ? `${st} · ${s.lead_status}` : s.lead_status
  }

  const owner = lead?.assign_to_staff_id ?? (assignToStaffId === undefined ? userId : assignToStaffId)
  const phone = lead?.contact_phone ?? contactPhone
  const name = lead?.contact_name ?? contactName ?? 'Unknown'

  function call() {
    if (!phone) return
    startCall({
      leadId,
      phone,
      countryCode: lead?.contact_country_code,
      assignToStaffId,
      onDial: () => {
        if (!leadId) return
        setDialedLeadId(leadId)
        // Bring the form into view once it has rendered.
        requestAnimationFrame(() => callFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      },
    })
  }

  function focusNote() {
    noteRef.current?.focus()
    noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function saveNote() {
    if (!leadId || !draft.trim()) return
    updateLead.mutate(
      { id: leadId, patch: { discussion: draft } },
      {
        onSuccess: () => {
          show({ title: 'Note saved', tone: 'success' })
          setDraft('')
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not save the note', tone: 'error' }),
      },
    )
  }

  function runStep() {
    if (step.action === 'call') return call()
    if (step.action === 'meeting' && step.meetingId) return navigate(`/meetings/${step.meetingId}`)
    if (step.action === 'payment') return setForm('payment')
    setForm('followup')
  }

  const callLead = dialedLeadId ? lead : undefined
  const details = lead ? <LeadDetailsPanel lead={lead} stage={stageName} onEdit={leadId ? () => setEditLeadOpen(true) : undefined} /> : null

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg)]">
        <div className="mx-auto w-full max-w-6xl p-3 sm:p-5 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start lg:gap-5">
          {details && <aside className="sticky top-5 hidden lg:block">{details}</aside>}

          <div className="min-w-0 space-y-3 sm:space-y-4">
            <LeadHero
              contactId={contactId}
              name={name}
              phone={phone}
              countryCode={lead?.contact_country_code}
              stage={stageName}
              status={lead?.lead_status}
              statusColor={lead?.lead_status_color}
              ownerName={lead?.assign_staff_name}
              ownerStaffId={owner}
              unassigned={assignToStaffId === null && Boolean(leadId)}
              onAssignToMe={leadId ? () => assignToMe(leadId) : undefined}
              onCall={call}
              onEmail={leadId && lead?.contact_email ? () => setEmailOpen(true) : undefined}
              isClaiming={isClaiming}
            >
              {followupStatus && followupDate && (
                <Badge tone={STATUS_TONE[followupStatus]}>
                  Follow-up {STATUS_LABEL[followupStatus].toLowerCase()} · {formatDate(followupDate)}
                  {followupTime ? ` ${formatTime(followupTime)}` : ''}
                </Badge>
              )}
            </LeadHero>

            {callLead && (
              <div ref={callFormRef} className="scroll-mt-3 rounded-[var(--radius-card)] border-2 border-[var(--accent-border)] bg-[var(--surface)] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-mono-num text-[11px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">Call status</p>
                  <button
                    type="button"
                    onClick={() => setDialedLeadId(null)}
                    aria-label="Close call status"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                  >
                    <X size={16} />
                  </button>
                </div>
                {followupId ? (
                  <FollowupCallForm
                    key={callLead.id}
                    lead={callLead}
                    followupId={followupId}
                    contactName={name}
                    onSubmitted={() => {
                      setDialedLeadId(null)
                      onCallSaved?.()
                    }}
                  />
                ) : (
                  <DispositionForm
                    key={callLead.id}
                    lead={callLead}
                    onSubmitted={() => {
                      setDialedLeadId(null)
                      onCallSaved?.()
                    }}
                  />
                )}
              </div>
            )}

            <NextStepCard step={step} onAction={runStep} />
            <QuickAddRow onAdd={setForm} onNote={focusNote} />
            <StatTiles totals={totals} onOpen={setTab} />

            <LeadTabBar
              value={tab}
              onChange={setTab}
              counts={{ calls: totals.calls, followup: totals.openFollowups, meeting: totals.meetings, deal: totals.deals, payment: payments.length }}
            />

            <div role="tabpanel">
              {tab === 'overview' && (
                <OverviewTab
                  calls={callLogs}
                  meetings={meetings}
                  deals={deals}
                  discussions={discussions}
                  statusName={statusName}
                  onCall={phone ? call : undefined}
                  onOpenTab={setTab}
                  onScheduleMeeting={() => setForm('meeting')}
                  onAddDeal={() => setForm('deal')}
                  onAddPayment={() => setForm('payment')}
                  onNote={focusNote}
                  loading={loadingCalls && loadingDeals}
                />
              )}
              {tab === 'timeline' &&
                (lead ? (
                  <LeadHistoryPanel key={`history-${lead.id}`} lead={lead} showAbout={false} />
                ) : (
                  <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">This contact has no lead, so there is no timeline.</p>
                ))}
              {tab === 'calls' && <CallsTab calls={callLogs} loading={loadingCalls} statusName={statusName} />}
              {tab === 'followup' && <FollowupsTab followups={followups} onAdd={() => setForm('followup')} />}
              {tab === 'meeting' && (
                <MeetingsTab meetings={meetings} loading={loadingMeetings} userId={userId} isAdmin={isAdmin} onAdd={() => setForm('meeting')} onOpen={(id) => navigate(`/meetings/${id}`)} />
              )}
              {tab === 'deal' && <DealsTab deals={deals} loading={loadingDeals} onAdd={() => setForm('deal')} onEdit={setEditingDeal} onPay={() => setForm('payment')} />}
              {tab === 'payment' && <PaymentsTab payments={payments} loading={loadingPayments} onAdd={() => setForm('payment')} />}
            </div>

            {details && (
              <div className="lg:hidden">
                <button
                  type="button"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="flex h-12 w-full items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 text-[14px] font-semibold text-[var(--text-h)]"
                >
                  Details
                  <span className="flex items-center gap-2 text-[12px] font-normal text-[var(--text-muted)]">
                    Phone, email, labels, groups
                    <ChevronDown size={16} className={cn('transition-transform', detailsOpen && 'rotate-180')} />
                  </span>
                </button>
                {detailsOpen && <div className="mt-3">{details}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {leadId && (
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-5">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2 lg:pl-[calc(17.5rem+1.25rem)]">
            <Input
              ref={noteRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveNote()
                }
              }}
              placeholder="Add a note about this client…"
              aria-label="Add a note"
              className="h-11"
            />
            <button
              type="button"
              onClick={saveNote}
              disabled={!draft.trim() || updateLead.isPending}
              aria-label="Save note"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--ink)] hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      )}

      <AddFollowupDialog open={form === 'followup'} onClose={() => setForm(null)} contactId={contactId} />
      <AddMeetingDialog open={form === 'meeting'} onClose={() => setForm(null)} contactId={contactId} />
      <AddPaymentDialog open={form === 'payment'} onClose={() => setForm(null)} contactId={contactId} />
      <DealFormDialog
        open={form === 'deal' || editingDeal !== null}
        onClose={() => {
          setForm(null)
          setEditingDeal(null)
        }}
        contactId={contactId}
        deal={editingDeal}
      />
      {leadId && <EditLeadDialog open={editLeadOpen} onClose={() => setEditLeadOpen(false)} leadId={leadId} />}
      {leadId && lead?.contact_email && <SendLeadEmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} leadId={leadId} toEmail={lead.contact_email} />}
    </>
  )
}
