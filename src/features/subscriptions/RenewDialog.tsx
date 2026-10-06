import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useRenewSubscription } from '@/api/queries'
import type { CrmSubscription } from '@/api/crmApi'
import { DURATION_OPTIONS, MOP_OPTIONS, addDays, endForDuration, formatAmount, formatDate } from './subscriptionUi'

interface RenewDialogProps {
  /** null = closed */
  subscription: CrmSubscription | null
  onClose: () => void
}

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

export function RenewDialog({ subscription, onClose }: RenewDialogProps) {
  return (
    <Dialog open={subscription !== null} onClose={onClose}>
      {subscription && <RenewForm key={subscription.id} subscription={subscription} onClose={onClose} />}
    </Dialog>
  )
}

const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value))
const invalidMoney = (n: number | undefined) => n !== undefined && (!Number.isFinite(n) || n < 0)

function RenewForm({ subscription, onClose }: { subscription: CrmSubscription; onClose: () => void }) {
  const renew = useRenewSubscription()
  const { show } = useToast()
  // The new term starts the day after the old one ends and runs a year by default.
  const defaultStart = addDays(subscription.end_date, 1)
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(endForDuration(defaultStart, 12))
  const [months, setMonths] = useState<number | null>(12)
  // Pre-filled with the last term's price, but editable: renewals often change price.
  const [amount, setAmount] = useState(subscription.amount === null ? '' : String(subscription.amount))
  const [received, setReceived] = useState('')
  const [mop, setMop] = useState(MOP_OPTIONS[0])
  const [notes, setNotes] = useState('')

  const amountNumber = toNumber(amount)
  const receivedNumber = toNumber(received)
  const amountInvalid = invalidMoney(amountNumber)
  const receivedInvalid =
    invalidMoney(receivedNumber) || (receivedNumber !== undefined && receivedNumber === 0)
  // Mirrors the server: money received can't exceed the renewal price.
  const receivedTooHigh =
    receivedNumber !== undefined && amountNumber !== undefined && receivedNumber > amountNumber
  const rangeInvalid = startDate !== '' && endDate !== '' && endDate <= startDate
  const valid =
    startDate !== '' && endDate !== '' && !rangeInvalid && !amountInvalid && !receivedInvalid && !receivedTooHigh

  const balance =
    receivedNumber !== undefined && amountNumber !== undefined && !receivedTooHigh ? amountNumber - receivedNumber : null

  function pickDuration(next: number) {
    setMonths(next)
    if (startDate) setEndDate(endForDuration(startDate, next))
  }

  function submit() {
    // The button is disabled while pending, so a double-tap can't submit twice;
    // the server also rejects a second renewal of the same term with a 409.
    renew.mutate(
      {
        id: subscription.id,
        startDate,
        endDate,
        ...(amountNumber !== undefined ? { amount: amountNumber } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(receivedNumber !== undefined ? { payment: { amount: receivedNumber, mop } } : {}),
      },
      {
        onSuccess: () => {
          show({ title: 'Subscription renewed', tone: 'success' })
          onClose()
        },
        onError: (err) =>
          show({ title: err instanceof Error ? err.message : 'Could not renew the subscription', tone: 'error' }),
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Renew subscription</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <p className="text-[13px] text-[var(--text-muted)]">
          {subscription.name ?? 'Customer'}
          {subscription.product_name ? ` · ${subscription.product_name}` : ''}
          <br />
          Current term ends {formatDate(subscription.end_date)}.
        </p>
        <Field label="Duration">
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((o) => (
              <button
                key={o.months}
                type="button"
                onClick={() => pickDuration(o.months)}
                className={
                  months === o.months
                    ? 'rounded-full border border-[var(--accent)] bg-[var(--accent-bg)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--accent-strong)]'
                    : 'rounded-full border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New start *">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                // Keep the chosen duration when the start moves.
                if (months !== null && e.target.value) setEndDate(endForDuration(e.target.value, months))
              }}
            />
          </Field>
          <Field label="New end *" error={rangeInvalid ? 'Must be after the start date' : undefined}>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                // A hand-picked end date no longer matches any quick-pick.
                setMonths(null)
              }}
            />
          </Field>
        </div>
        <Field label="Renewal amount (₹)" hint="Optional" error={amountInvalid ? 'Enter a valid amount' : undefined}>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 4999"
          />
        </Field>

        <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
          <p className="text-[12.5px] text-[var(--text-muted)]">
            Money received now counts toward this month’s target. Leave it empty if the customer hasn’t paid yet — you can
            record it later.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Payment received (₹)"
              hint="Optional"
              error={
                receivedTooHigh
                  ? 'More than the renewal amount'
                  : receivedInvalid
                    ? 'Enter an amount above 0'
                    : undefined
              }
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder="e.g. 2000"
              />
            </Field>
            <Field label="Payment mode">
              <select
                value={mop}
                onChange={(e) => setMop(e.target.value)}
                disabled={receivedNumber === undefined}
                className={SELECT_CLASS}
              >
                {MOP_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {balance !== null && balance > 0 && (
            <p className="text-[12.5px] text-[var(--text-muted)]">Balance after this payment: {formatAmount(balance)}</p>
          )}
        </div>

        <Field label="Notes" hint="Optional">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={!valid || renew.isPending} onClick={submit}>
          {renew.isPending ? 'Renewing…' : 'Renew'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
