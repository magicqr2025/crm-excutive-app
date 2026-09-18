import { PageHeader } from '@/components/layout/PageHeader'
import { useMyLeadCampaigns } from '@/api/queries'
import { CampaignCard } from '@/features/campaigns/CampaignCard'

export function CampaignsPage() {
  const { data: campaigns = [], isLoading } = useMyLeadCampaigns()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="My Campaigns" subtitle="Campaigns assigned to you." />
      <div className="p-6">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">No campaigns assigned to you yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
