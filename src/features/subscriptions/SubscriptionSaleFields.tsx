import { Field, Input } from '@/components/ui/Input'
import type { CrmSubscription } from '@/api/crmApi'
import {
  DURATION_OPTIONS,
  endForDuration,
  formatDate,
  type SaleDraft,
} from './subscriptionUi'

export interface SaleProduct {
  id: string
  name: string
  /** List price, used to pre-fill the sold amount (the executive can change it). */
  price: number
}

interface SubscriptionSaleFieldsProps {
  draft: SaleDraft
  onChange: (next: SaleDraft) => void
  products: SaleProduct[]
  /** This customer's existing subscriptions, to warn about selling the same product twice. */
  existing: Pick<CrmSubscription, 'product_id' | 'product_name' | 'status' | 'end_date'>[]
}

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

// The "new subscription sale" part of the Log payment form: what was sold, for how
// much, and for how long. Saving the form creates the subscription and the payment
// together, so nothing has to be linked or typed twice afterwards.
export function SubscriptionSaleFields({ draft, onChange, products, existing }: SubscriptionSaleFieldsProps) {
  const rangeInvalid = draft.startDate !== '' && draft.endDate !== '' && draft.endDate <= draft.startDate
  const soldInvalid = draft.soldAmount !== '' && !(Number(draft.soldAmount) > 0)
  const running = existing.find(
    (s) => draft.productId !== '' && s.product_id === draft.productId && (s.status === 'active' || s.status === 'expired'),
  )

  function pickProduct(productId: string) {
    const product = products.find((p) => p.id === productId)
    onChange({
      ...draft,
      productId,
      // Pre-fill the list price unless the executive already typed their own amount.
      soldAmount: !draft.amountTouched && product && product.price > 0 ? String(product.price) : draft.soldAmount,
    })
  }

  function pickDuration(months: number) {
    onChange({ ...draft, months, endDate: draft.startDate ? endForDuration(draft.startDate, months) : draft.endDate })
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] p-3">
      <Field label="Product *">
        <select value={draft.productId} onChange={(e) => pickProduct(e.target.value)} className={SELECT_CLASS}>
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      {running && (
        <p className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] p-2 text-[12.5px] text-[var(--warning)]">
          This customer already has {running.status === 'active' ? 'an active' : 'an expired'} {running.product_name ?? 'subscription'} term
          ending {formatDate(running.end_date)}. If this is a renewal, use <strong>Renew</strong> on the Subscriptions page instead.
        </p>
      )}

      <Field
        label="Sold amount (₹) *"
        hint="Pre-filled from the product price — change it if you sold for more or less."
        error={soldInvalid ? 'Enter an amount above 0' : undefined}
      >
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={draft.soldAmount}
          onChange={(e) => onChange({ ...draft, soldAmount: e.target.value, amountTouched: true })}
          placeholder="e.g. 4999"
        />
      </Field>

      <Field label="Duration">
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((o) => (
            <button
              key={o.months}
              type="button"
              onClick={() => pickDuration(o.months)}
              className={
                draft.months === o.months
                  ? 'rounded-full border border-[var(--accent)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--accent-strong)]'
                  : 'rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date *">
          <Input
            type="date"
            value={draft.startDate}
            onChange={(e) =>
              onChange({
                ...draft,
                startDate: e.target.value,
                // Keep the chosen duration when the start moves.
                endDate: draft.months !== null && e.target.value ? endForDuration(e.target.value, draft.months) : draft.endDate,
              })
            }
          />
        </Field>
        <Field label="End date *" error={rangeInvalid ? 'Must be after the start date' : undefined}>
          <Input
            type="date"
            value={draft.endDate}
            // A hand-picked end date no longer matches any quick-pick.
            onChange={(e) => onChange({ ...draft, endDate: e.target.value, months: null })}
          />
        </Field>
      </div>
    </div>
  )
}
