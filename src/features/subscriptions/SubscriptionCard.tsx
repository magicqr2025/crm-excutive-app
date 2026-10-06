import { CalendarClock, IndianRupee, Phone, RefreshCw, ThumbsDown } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { CrmSubscription } from '@/api/crmApi'
import { canReceivePayment, daysLeftLabel, daysLeftTone, formatAmount, formatDate, lostReasonLabel } from './subscriptionUi'

interface SubscriptionCardProps {
  subscription: CrmSubscription
  onRenew: (subscription: CrmSubscription) => void
  onLost: (subscription: CrmSubscription) => void
  onPayment: (subscription: CrmSubscription) => void
}

export function SubscriptionCard({ subscription: sub, onRenew, onLost, onPayment }: SubscriptionCardProps) {
  const canRenew = sub.status === 'active' || sub.status === 'expired'
  const urgent = sub.status === 'active' && sub.days_left !== null && sub.days_left <= 3

  return (
    <div className={`rounded-lg border p-3 ${urgent ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-[13.5px] font-medium text-[var(--text-h)]">{sub.name ?? 'Unknown customer'}</p>
        <Badge tone={daysLeftTone(sub)}>{daysLeftLabel(sub)}</Badge>
      </div>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">{sub.product_name ?? 'No product'}</p>
      <p className="mt-1 flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
        <CalendarClock size={12} /> {formatDate(sub.start_date)} → {formatDate(sub.end_date)}
      </p>
      {sub.amount !== null && (
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          {formatAmount(sub.amount)} · Received {formatAmount(sub.paid_amount)}
          {(sub.balance ?? 0) > 0 && <span className="font-medium text-[var(--warning)]"> · Due {formatAmount(sub.balance)}</span>}
        </p>
      )}
      {sub.status === 'lost' && (
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">Not renewing: {lostReasonLabel(sub.lost_reason)}</p>
      )}
      {sub.notes && <p className="mt-1 whitespace-pre-wrap break-words text-[12px] text-[var(--text-muted)]">{sub.notes}</p>}
      {(sub.contact_phone || canRenew || canReceivePayment(sub)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sub.contact_phone && (
            <a href={`tel:${sub.contact_phone}`}>
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Phone size={13} /> Call
              </Button>
            </a>
          )}
          {canRenew && (
            <Button size="sm" className="gap-1.5" onClick={() => onRenew(sub)}>
              <RefreshCw size={13} /> Renew
            </Button>
          )}
          {canReceivePayment(sub) && (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onPayment(sub)}>
              <IndianRupee size={13} /> Record payment
            </Button>
          )}
          {canRenew && (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onLost(sub)}>
              <ThumbsDown size={13} /> Not interested
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
