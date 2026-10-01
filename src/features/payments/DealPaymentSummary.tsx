import { Badge } from '@/components/ui/Badge'
import type { CrmDeal, DealPaymentStatus } from '@/api/crmApi'

const STATUS_TONE: Record<DealPaymentStatus, 'success' | 'warning' | 'neutral'> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'neutral',
}

const STATUS_LABEL: Record<DealPaymentStatus, string> = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function DealPaymentBadge({ status }: { status: DealPaymentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

/** Received / balance line, plus the reason and expected date when the deal is short-paid. */
export function DealPaymentSummary({ deal }: { deal: CrmDeal }) {
  if (deal.status === 'canceled') return null
  return (
    <div className="mt-1.5 space-y-0.5 text-[12px] text-[var(--text-muted)]">
      <p>
        Received <span className="font-mono-num text-[var(--text-h)]">{formatMoney(deal.net_paid_amount)}</span>
        {deal.balance_amount > 0 && (
          <>
            {' · '}Balance <span className="font-mono-num font-semibold text-[var(--warning)]">{formatMoney(deal.balance_amount)}</span>
          </>
        )}
      </p>
      {deal.balance_amount > 0 && deal.short_payment_reason && (
        <p>
          Reason: {deal.short_payment_reason}
          {deal.expected_balance_date && ` · expected ${new Date(deal.expected_balance_date).toLocaleDateString(undefined, { timeZone: 'UTC' })}`}
        </p>
      )}
    </div>
  )
}
