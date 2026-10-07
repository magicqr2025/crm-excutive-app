import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useRecordSubscriptionPayment } from '@/api/queries'
import type { CrmSubscription } from '@/api/crmApi'
import { MOP_OPTIONS, formatAmount, newRequestId } from './subscriptionUi'

interface PaymentDialogProps {
  /** null = closed */
  subscription: CrmSubscription | null
  onClose: () => void
}

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

// Records money received for a subscription term. It is credited to the
// salesperson and dated today, so it counts toward the month it arrives in.
export function PaymentDialog({ subscription, onClose }: PaymentDialogProps) {
  return (
    <Dialog open={subscription !== null} onClose={onClose}>
      {subscription && <PaymentForm key={subscription.id} subscription={subscription} onClose={onClose} />}
    </Dialog>
  )
}

function PaymentForm({ subscription, onClose }: { subscription: CrmSubscription; onClose: () => void }) {
  const record = useRecordSubscriptionPayment()
  const { show } = useToast()
  const balance = subscription.balance ?? 0
  const [amount, setAmount] = useState(String(balance))
  const [mop, setMop] = useState(MOP_OPTIONS[0])
  // One key per dialog, so a retried tap or flaky-network resend records one payment.
  const [requestId] = useState(newRequestId)

  const amountNumber = amount.trim() === '' ? NaN : Number(amount)
  const tooHigh = Number.isFinite(amountNumber) && amountNumber > balance
  const invalid = !Number.isFinite(amountNumber) || amountNumber <= 0
  const valid = !invalid && !tooHigh

  function submit() {
    record.mutate(
      { id: subscription.id, amount: amountNumber, mop, clientRequestId: requestId },
      {
        onSuccess: () => {
          show({ title: 'Payment recorded', tone: 'success' })
          onClose()
        },
        onError: (err) =>
          show({ title: err instanceof Error ? err.message : 'Could not record the payment', tone: 'error' }),
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Record payment</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <p className="text-[13px] text-[var(--text-muted)]">
          {subscription.name ?? 'Customer'}
          {subscription.product_name ? ` · ${subscription.product_name}` : ''}
          <br />
          Amount {formatAmount(subscription.amount)} · Received {formatAmount(subscription.paid_amount)} · Balance{' '}
          {formatAmount(subscription.balance)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Amount received (₹) *"
            error={tooHigh ? `More than the ${formatAmount(balance)} balance` : invalid ? 'Enter an amount above 0' : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Payment mode *">
            <select value={mop} onChange={(e) => setMop(e.target.value)} className={SELECT_CLASS}>
              {MOP_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-[12.5px] text-[var(--text-muted)]">
          Counts toward the salesperson’s target for the month it is received (today).
        </p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={!valid || record.isPending} onClick={submit}>
          {record.isPending ? 'Saving…' : 'Record payment'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
