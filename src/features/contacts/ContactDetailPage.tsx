import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLead } from '@/api/queries'
import { CONTACT_DETAIL_TABS, ContactDetailView, type ContactDetailTab } from '@/features/contacts/ContactDetailView'

export function ContactDetailPage() {
  const { leadId = '' } = useParams<{ leadId: string }>()
  const navigate = useNavigate()
  // ?tab=deal|meeting|payment opens that tab directly (e.g. from a Deals card).
  const tabParam = useSearchParams()[0].get('tab') as ContactDetailTab | null
  const initialTab = tabParam && CONTACT_DETAIL_TABS.includes(tabParam) ? tabParam : undefined
  const { data: lead, isLoading } = useLead(leadId)

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">Loading…</div>
  }

  if (!lead) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-[var(--text-muted)]">Contact not found.</p>
        <button onClick={() => navigate('/contacts')} className="text-[13px] text-[var(--accent)]">
          Back to contacts
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <button
          onClick={() => navigate('/contacts')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <p className="text-[13.5px] font-semibold text-[var(--text-h)]">Contact Details</p>
      </div>

      <ContactDetailView
        contactId={lead.contact_id}
        leadId={lead.id}
        contactName={lead.contact_name}
        contactPhone={lead.contact_phone}
        followupDate={lead.followup_date}
        followupTime={lead.followup_time}
        followupStatus={lead.followup_status}
        assignToStaffId={lead.assign_to_staff_id ?? null}
        initialTab={initialTab}
      />
    </div>
  )
}
