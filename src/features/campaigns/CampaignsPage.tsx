import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useMyLeadCampaigns } from '@/api/queries'
import { useAuthStore } from '@/store/useAuthStore'
import { CampaignCard } from '@/features/campaigns/CampaignCard'
import { AddNewLeadDialog } from '@/features/contacts/AddNewLeadDialog'

export function CampaignsPage() {
  const { data: campaigns = [], isLoading } = useMyLeadCampaigns()
  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title={isAdmin ? 'Pipelines' : 'My Pipelines'}
        subtitle={isAdmin ? 'Create and manage your sales pipelines.' : 'Campaigns assigned to you.'}
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button size="sm" variant="secondary" onClick={() => navigate('/campaigns/new')}>
                <Plus size={14} />
                New pipeline
              </Button>
            )}
            <Button size="sm" onClick={() => setAddLeadOpen(true)}>
              <Plus size={14} />
              Add New Lead
            </Button>
          </div>
        }
      />
      {addLeadOpen && <AddNewLeadDialog onClose={() => setAddLeadOpen(false)} />}
      <div className="p-6">
        {isLoading ? (
          <PageLoader />
        ) : campaigns.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">{isAdmin ? 'No pipelines yet. Create your first one.' : 'No pipelines assigned to you yet.'}</p>
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
