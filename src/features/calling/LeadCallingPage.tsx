import { PageLoader } from '@/components/ui/Spinner'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useLead } from '@/api/queries'
import { fetchNextQueueLead } from '@/api/crmApi'
import { ContactDetailView } from '@/features/contacts/ContactDetailView'

export function LeadCallingPage() {
  const { campaignId = '', leadId = '' } = useParams<{ campaignId: string; leadId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromList = searchParams.get('from') === 'list'
  // Back to the leads list with the same search + filters it was opened from.
  const listParams = new URLSearchParams(searchParams)
  listParams.delete('from')
  const listQuery = listParams.toString()
  const leadsListUrl = `/campaigns/${campaignId}/leads${listQuery ? `?${listQuery}` : ''}`
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: lead, isLoading } = useLead(leadId)
  // Fetched fresh here rather than read from a passively-rendered query hook:
  // the disposition can be submitted faster than a background "next lead"
  // prefetch resolves (real risk given crmbackend's DB round-trip latency),
  // so the hook's cached value may still be stale/pending at submit time.
  async function handleSubmitted() {
    // Opened from View Leads: the executive chooses who to call next, so go back to the list.
    if (fromList) {
      navigate(leadsListUrl, { replace: true })
      return
    }
    const next = await fetchNextQueueLead(campaignId, userId, leadId)
    if (next) {
      navigate(`/campaigns/${campaignId}/call/${next.id}`, { replace: true })
    } else {
      navigate(`/campaigns/${campaignId}/leads`, { replace: true })
    }
  }

  if (isLoading) {
    return <PageLoader fullPage />
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
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <button
          onClick={() => navigate(leadsListUrl)}
          aria-label="Back to leads"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <p className="text-[13.5px] font-semibold text-[var(--text-h)]">Lead Details</p>
      </div>

      <ContactDetailView
        key={lead.id}
        contactId={lead.contact_id}
        leadId={lead.id}
        contactName={lead.contact_name}
        contactPhone={lead.contact_phone}
        assignToStaffId={lead.assign_to_staff_id ?? null}
        lead={lead}
        onCallSaved={handleSubmitted}
      />
    </div>
  )
}
