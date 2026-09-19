import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchNextQueueLead } from '@/api/crmApi'
import type { CrmMyLeadCampaign } from '@/api/crmApi'
import { cn } from '@/lib/utils'

function DialRing({ value, size = 52 }: { value: number; size?: number }) {
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(value, 0), 1)
  const offset = circumference * (1 - clamped)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono-num text-[11px] font-semibold text-[var(--text-h)]">{Math.round(clamped * 100)}%</span>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'live' | 'dead' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span
        className={cn(
          'font-mono-num text-[15px] font-semibold',
          tone === 'live' ? 'text-[var(--success)]' : tone === 'dead' ? 'text-[var(--error)]' : 'text-[var(--text-h)]',
        )}
      >
        {String(value).padStart(2, '0')}
      </span>
    </div>
  )
}

export function CampaignCard({ campaign }: { campaign: CrmMyLeadCampaign }) {
  const navigate = useNavigate()
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [starting, setStarting] = useState(false)

  const worked = campaign.assigned > 0 ? (campaign.assigned - campaign.uncontacted) / campaign.assigned : 0

  async function startCalling() {
    setStarting(true)
    try {
      const lead = await fetchNextQueueLead(campaign.id, userId)
      if (!lead) {
        show({ title: 'No leads to call in this campaign', tone: 'error' })
        return
      }
      navigate(`/campaigns/${campaign.id}/call/${lead.id}`)
    } catch (err) {
      show({ title: err instanceof Error ? err.message : 'Failed to start calling', tone: 'error' })
    } finally {
      setStarting(false)
    }
  }

  return (
    <Card>
      <Card.Header>
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold text-[var(--text-h)]">{campaign.name}</p>
          <p className="mt-0.5 font-mono-num text-[11px] text-[var(--text-muted)]">{String(campaign.lead_count).padStart(2, '0')} leads total</p>
        </div>
        <DialRing value={worked} />
      </Card.Header>
      <Card.Body>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 sm:grid-cols-3">
          <Stat label="Assigned" value={campaign.assigned} />
          <Stat label="Uncontacted" value={campaign.uncontacted} tone={campaign.uncontacted > 0 ? 'dead' : undefined} />
          <Stat label="In-Progress" value={campaign.in_progress} />
          <Stat label="Closed" value={campaign.closed} tone="live" />
          <Stat label="Un-Assigned" value={campaign.unassigned} />
        </div>
        <Button variant="call" className="mt-4 w-full justify-center gap-2" onClick={startCalling} disabled={starting}>
          <Phone size={15} />
          {starting ? 'Connecting…' : 'Start Calling'}
        </Button>
      </Card.Body>
    </Card>
  )
}
