import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/useAuthStore'
import { useLeadsForCampaign, useMyLeadCampaigns } from '@/api/queries'

export function CampaignLeadsPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: campaigns = [] } = useMyLeadCampaigns()
  const { data: leads = [], isLoading } = useLeadsForCampaign(campaignId, userId)
  const campaign = campaigns.find((c) => c.id === campaignId)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <button
          onClick={() => navigate('/campaigns')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="text-[13.5px] font-semibold text-[var(--text-h)]">{campaign?.name ?? 'Campaign'}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{leads.length} leads</p>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : leads.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No leads for you in this campaign yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => navigate(`/campaigns/${campaignId}/call/${lead.id}`)}
                className="rounded-xl border border-[var(--border)] p-3.5 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={lead.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Badge tone={lead.lead_status ? 'accent' : 'warning'}>{lead.lead_status ?? 'Fresh Inquiry'}</Badge>
                  {lead.tag_name && <Badge tone="neutral">{lead.tag_name}</Badge>}
                  {!lead.assign_to_staff_id && <Badge tone="warning">Unassigned</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
