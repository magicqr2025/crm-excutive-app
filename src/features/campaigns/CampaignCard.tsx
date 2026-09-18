import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { CrmMyLeadCampaign } from '@/api/crmApi'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11.5px] text-[var(--text-muted)]">{label}</p>
      <p className="text-[15px] font-semibold text-[var(--text-h)]">{value}</p>
    </div>
  )
}

export function CampaignCard({ campaign }: { campaign: CrmMyLeadCampaign }) {
  const navigate = useNavigate()
  return (
    <Card>
      <Card.Header>
        <p className="text-[14px] font-semibold text-[var(--text-h)]">{campaign.name}</p>
      </Card.Header>
      <Card.Body>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Assigned" value={campaign.assigned} />
          <Stat label="Uncontacted" value={campaign.uncontacted} />
          <Stat label="In-Progress" value={campaign.in_progress} />
          <Stat label="Closed" value={campaign.closed} />
        </div>
        <div className="mt-2">
          <Stat label="Un-Assigned" value={campaign.unassigned} />
        </div>
        <Button className="mt-4 w-full justify-center" onClick={() => navigate(`/campaigns/${campaign.id}/leads`)}>
          Start Calling
        </Button>
      </Card.Body>
    </Card>
  )
}
