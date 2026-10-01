import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useCreatePayment, useDeals } from '@/api/queries'

const MOP_OPTIONS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function todayDateInput() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, viewer's local calendar day
}

// Staff can't back-date into a month that has already closed (the server enforces
// it too), so the picker starts at the 1st of the current month.
function monthStartInput() {
  return `${todayDateInput().slice(0, 8)}01`
}

// One id per form session. If the network drops mid-save and the user taps
// Confirm again, the server replays the first payment instead of duplicating it.
function newRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

interface RecordPaymentFormProps {
  contactId: string
  onDone: () => void
  onCancel: () => void
}

/**
 * Records money received from a client. Picking the deal it belongs to is what
 * makes the amount count toward the executive's monthly target as "received" and
 * lets the app show the balance. If the payment leaves a balance, a reason and an
 * expected date are required — the server turns those into a collection task.
 */
export function RecordPaymentForm({ contactId, onDone, onCancel }: RecordPaymentFormProps) {
  const { show } = useToast()
  const createPayment = useCreatePayment()
  const { data: dealsData, isLoading: loadingDeals } = useDeals(contactId)
  const openDeals = (dealsData?.deals ?? []).filter((d) => d.status !== 'canceled' && d.balance_amount > 0)

  const [dealChoice, setDealChoice] = useState<string | null>(null) // null = not touched yet
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [mop, setMop] = useState(MOP_OPTIONS[0])
  const [notes, setNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayDateInput())
  const [reason, setReason] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [requestId, setRequestId] = useState(newRequestId)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // With exactly one open deal there's nothing to choose — use it.
  const dealId = dealChoice ?? (openDeals.length === 1 ? openDeals[0].id : '')
  const deal = openDeals.find((d) => d.id === dealId) ?? null

  const amountNum = Number(amount)
  const amountValid = amountNum > 0
  const remaining = deal ? Math.round((deal.balance_amount - amountNum) * 100) / 100 : 0
  const overpays = deal !== null && remaining < 0
  const isShort = deal !== null && amountValid && remaining > 0
  const reasonOk = !isShort || reason.trim().length >= 3
  const expectedOk = !isShort || expectedDate > todayDateInput()
  const canReview = amountValid && !overpays && reasonOk && expectedOk && Boolean(paymentDate)

  function save() {
    setSubmitError(null)
    createPayment.mutate(
      {
        contactId,
        dealId: deal?.id,
        amount: amountNum,
        currency,
        mop,
        notes: notes.trim() || undefined,
        paymentDate,
        reason: isShort ? reason.trim() : undefined,
        expectedBalanceDate: isShort ? expectedDate : undefined,
        clientRequestId: requestId,
      },
      {
        onSuccess: () => {
          show({ title: 'Payment logged', tone: 'success' })
          setRequestId(newRequestId())
          onDone()
        },
        // Keep every typed value and the same request id so a retry is safe.
        onError: (err) => setSubmitError(err instanceof Error ? err.message : "Couldn't save the payment. Check your connection and try again."),
      },
    )
  }

  if (confirming) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
        <p className="text-[13.5px] font-semibold text-[var(--text-h)]">
          Record {currency} {formatMoney(amountNum)} via {mop}?
        </p>
        {deal && (
          <p className="text-[12.5px] text-[var(--text-muted)]">
            {deal.deal_name}: {remaining > 0 ? `${currency} ${formatMoney(remaining)} will still be due` : 'this settles the deal in full'}.
          </p>
        )}
        <p className="text-[12px] text-[var(--text-muted)]">You can't edit a payment after saving — ask an admin to correct it.</p>
        {submitError && <p className="text-[12.5px] text-[var(--error)]">{submitError}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setConfirming(false)} disabled={createPayment.isPending}>
            Back
          </Button>
          <Button size="sm" className="flex-1 justify-center" onClick={save} disabled={createPayment.isPending}>
            {createPayment.isPending ? 'Saving…' : submitError ? 'Try again' : 'Confirm'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
      <Field label="Deal" hint={loadingDeals ? 'Loading deals…' : openDeals.length === 0 ? 'No open deal for this client — this will be a standalone payment.' : undefined}>
        <select
          value={dealId}
          onChange={(e) => setDealChoice(e.target.value)}
          disabled={loadingDeals || openDeals.length === 0}
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
        >
          <option value="">No deal (standalone payment)</option>
          {openDeals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.deal_name} — {formatMoney(d.balance_amount)} due
            </option>
          ))}
        </select>
      </Field>

      {deal && (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--surface-hover)] p-2.5 text-center">
          {[
            ['Deal', deal.deal_amount],
            ['Received', deal.net_paid_amount],
            ['Balance', deal.balance_amount],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
              <p className="font-mono-num text-[13px] font-semibold text-[var(--text-h)]">{formatMoney(value as number)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount received *" error={overpays ? `More than the ${formatMoney(deal!.balance_amount)} balance` : undefined}>
          <Input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Currency">
          <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </Field>
      </div>

      {isShort && (
        <div className="space-y-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3">
          <p className="text-[12.5px] font-medium text-[var(--warning)]">
            {currency} {formatMoney(remaining)} will remain unpaid. Tell us why — a reminder is created to collect it.
          </p>
          <Field label="Reason for short payment *" error={reason && !reasonOk ? 'Please give a short reason' : undefined}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Client will pay the rest after budget approval" />
          </Field>
          <Field label="Balance expected by *" error={expectedDate && !expectedOk ? 'Pick a future date' : undefined}>
            <Input type="date" value={expectedDate} min={todayDateInput()} onChange={(e) => setExpectedDate(e.target.value)} />
          </Field>
        </div>
      )}

      <Field label="Payment date">
        <Input type="date" value={paymentDate} min={monthStartInput()} max={todayDateInput()} onChange={(e) => setPaymentDate(e.target.value)} />
      </Field>
      <Field label="Payment method">
        <select
          value={mop}
          onChange={(e) => setMop(e.target.value)}
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
        >
          {MOP_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes" hint="Optional">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reference / notes…" />
      </Field>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1 justify-center" onClick={() => setConfirming(true)} disabled={!canReview}>
          Review
        </Button>
      </div>
    </div>
  )
}
