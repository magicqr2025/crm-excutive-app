import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/useAuthStore'
import { useLeadsForCampaign, useMyLeadCampaigns } from '@/api/queries'
import type { CampaignLeadScope } from '@/api/crmApi'
import { cn } from '@/lib/utils'

const TABS: { value: CampaignLeadScope; label: string }[] = [
  { value: 'mine', label: 'My Leads' },
  { value: 'campaign', label: 'All Leads' },
]

export function CampaignLeadsPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [scope, setScope] = useState<CampaignLeadScope>('mine')
  const { data: campaigns = [] } = useMyLeadCampaigns()
  const { data: leads = [], isLoading, error } = useLeadsForCampaign(campaignId, userId, scope)
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
        <div className="ml-auto flex rounded-lg border border-[var(--border)] p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setScope(tab.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12.5px] font-medium',
                scope === tab.value
                  ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : error ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">
            {error instanceof Error ? error.message : 'Failed to load leads'}
          </p>
        ) : leads.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {scope === 'mine' ? 'No leads for you in this campaign yet.' : 'No leads in this campaign yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => {
              // Another executive's lead: view-only, can't be called from here.
              const othersLead = Boolean(lead.assign_to_staff_id) && lead.assign_to_staff_id !== userId
              return (
                <button
                  key={lead.id}
                  type="button"
                  disabled={othersLead}
                  onClick={() => navigate(`/campaigns/${campaignId}/call/${lead.id}`)}
                  className={cn(
                    'rounded-xl border border-[var(--border)] p-3.5 text-left',
                    othersLead ? 'cursor-default opacity-75' : 'hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={lead.contact_name ?? 'Unknown'} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
                      <p className="text-[12px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
                    </div>
                    {othersLead && <Lock size={14} className="ml-auto shrink-0 text-[var(--text-muted)]" />}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Badge tone={lead.lead_status ? 'accent' : 'warning'}>{lead.lead_status ?? 'Fresh Inquiry'}</Badge>
                    {lead.tag_name && <Badge tone="neutral">{lead.tag_name}</Badge>}
                    {!lead.assign_to_staff_id && <Badge tone="warning">Unassigned</Badge>}
                    {othersLead && <Badge tone="neutral">{lead.assign_staff_name || 'Another executive'}</Badge>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
