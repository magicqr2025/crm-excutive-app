import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useLeadsForCampaign } from '@/api/queries'
import { fetchNextQueueLead } from '@/api/crmApi'
import { DispositionForm } from '@/features/calling/DispositionForm'
import { useCallLead } from '@/features/calling/useCallLead'

export function LeadCallingPage() {
  const { campaignId = '', leadId = '' } = useParams<{ campaignId: string; leadId: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: leads = [], isLoading } = useLeadsForCampaign(campaignId, userId)
  const lead = leads.find((l) => l.id === leadId)
  const { startCall, assignToMe, isClaiming } = useCallLead()

  // Fetched fresh here rather than read from a passively-rendered query hook:
  // the disposition can be submitted faster than a background "next lead"
  // prefetch resolves (real risk given crmbackend's DB round-trip latency),
  // so the hook's cached value may still be stale/pending at submit time.
  async function handleSubmitted() {
    const next = await fetchNextQueueLead(campaignId, userId, leadId)
    if (next) {
      navigate(`/campaigns/${campaignId}/call/${next.id}`, { replace: true })
    } else {
      navigate(`/campaigns/${campaignId}/leads`, { replace: true })
    }
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">Loading…</div>
  }

  if (!lead) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-[var(--text-muted)]">Lead not found.</p>
        <button onClick={() => navigate(`/campaigns/${campaignId}/leads`)} className="text-[13px] text-[var(--accent)]">
          Back to leads
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}/leads`)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <p className="text-[13.5px] font-semibold text-[var(--text-h)]">Lead Details</p>
      </div>

      <div className="mx-auto w-full max-w-lg space-y-4 p-4">
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <p className="text-[15px] font-semibold text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
          <p className="font-mono-num text-[13px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
          {!lead.assign_to_staff_id && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-[12px] text-[var(--text-muted)]">Unassigned — calling assigns this lead to you.</p>
              <button
                type="button"
                onClick={() => assignToMe(lead.id)}
                disabled={isClaiming}
                className="text-[12px] font-semibold text-[var(--accent)] hover:underline disabled:opacity-60"
              >
                Assign to me
              </button>
            </div>
          )}
          {lead.deal_value && <p className="mt-2 text-[13px] text-[var(--text)]">Deal Amount: {lead.deal_value}</p>}
          {lead.contact_phone && (
            <button
              type="button"
              onClick={() => startCall({ leadId: lead.id, phone: lead.contact_phone, assignToStaffId: lead.assign_to_staff_id ?? null })}
              disabled={isClaiming}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--success)] px-4 text-[13px] font-semibold text-[var(--ink)] hover:brightness-110 disabled:opacity-60"
            >
              <Phone size={14} /> {isClaiming ? 'Assigning…' : 'Call'} <span className="font-mono-num">{lead.contact_phone}</span>
            </button>
          )}
        </div>

        <DispositionForm key={lead.id} lead={lead} onSubmitted={handleSubmitted} />
      </div>
    </div>
  )
}
