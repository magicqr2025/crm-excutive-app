import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useFollowup } from '@/api/queries'
import { ContactDetailView } from '@/features/contacts/ContactDetailView'

export function FollowupDetailPage() {
  const { followupId = '' } = useParams<{ followupId: string }>()
  const navigate = useNavigate()
  const { data: followup, isLoading } = useFollowup(followupId)
  // ?call=1: the Call button on a Follow-ups card dialled already, so open on the call form. Read once,
  // so a later refresh of the same address doesn't reopen it after the call was saved.
  const [searchParams] = useSearchParams()
  const [openCallForm] = useState(() => searchParams.get('call') === '1')

  if (isLoading) {
    return <PageLoader fullPage />
  }

  if (!followup) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-[var(--text-muted)]">Follow-up not found.</p>
        <button onClick={() => navigate('/followups')} className="text-[13px] text-[var(--accent)]">
          Back to follow-ups
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <button
          onClick={() => navigate('/followups')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <p className="text-[13.5px] font-semibold text-[var(--text-h)]">Follow-up Details</p>
      </div>

      <ContactDetailView
        contactId={followup.contact_id}
        leadId={followup.lead_id}
        contactName={followup.contact_name}
        contactPhone={followup.contact_phone}
        followupDate={followup.followup_date}
        followupTime={followup.followup_time}
        followupStatus={followup.followup_status}
        followupId={followup.followup_status === '2' ? undefined : followup.id}
        openCallForm={openCallForm && followup.followup_status !== '2' && Boolean(followup.lead_id)}
      />
    </div>
  )
}
