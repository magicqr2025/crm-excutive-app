import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { usePaymentsPage, useMyTargets } from '@/api/queries'
import type { CrmContact, CrmPayment } from '@/api/crmApi'
import { RecordPaymentForm } from './RecordPaymentForm'

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

// This month's progress, measured on money actually received (not deal value).
function MonthTargetStrip() {
  const { data: targets } = useMyTargets()
  const now = new Date()
  const current = targets?.find((t) => t.target_year === now.getFullYear() && t.target_month === now.getMonth() + 1)
  if (!current || current.target_amount <= 0) return null
  const pct = Math.max(0, Math.min(100, Math.round((current.achieved_amount / current.target_amount) * 100)))
  return (
    <div className="mb-4 rounded-2xl border border-[var(--border)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-[var(--text-h)]">This month's target</p>
        <p className="font-mono-num text-[13px] text-[var(--text-h)]">
          {formatMoney(current.achieved_amount)} <span className="text-[var(--text-muted)]">/ {formatMoney(current.target_amount)}</span>
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[12px] text-[var(--text-muted)]">
        Only money received counts.
        {current.collected_from_earlier_months > 0 && ` ${formatMoney(current.collected_from_earlier_months)} of it paid earlier months' deals.`}
        {current.pending_amount > 0 && ` ${formatMoney(current.pending_amount)} is still due on deals you closed this month.`}
      </p>
    </div>
  )
}

export function PaymentsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { items: payments, total, summary, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = usePaymentsPage(search)
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)

  function closeForm() {
    setContact(null)
    setFormOpen(false)
  }

  function openPayment(payment: CrmPayment) {
    // Contact pages are keyed by lead id; the API gives each payment its contact's latest lead.
    const leadId = payment.lead_id
    if (!leadId) {
      show({ title: "This payment's contact isn't in your contacts", tone: 'error' })
      return
    }
    navigate(`/contacts/${leadId}?tab=payment`)
  }

  const successAmount = summary?.success_amount ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Payments"
        subtitle={`${total} payment${total === 1 ? '' : 's'} · ${formatMoney(successAmount)} collected`}
        action={
          <Button size="sm" onClick={() => (formOpen ? closeForm() : setFormOpen(true))} className="gap-1.5">
            {formOpen ? <X size={14} /> : <Plus size={14} />}
            {formOpen ? 'Close' : 'Log Payment'}
          </Button>
        }
      />
      <div className="p-4">
        <MonthTargetStrip />

        {formOpen && (
          <div className="mb-4 space-y-3">
            <Field label="Contact">
              <ContactPicker value={contact} onChange={setContact} />
            </Field>
            {contact && <RecordPaymentForm key={contact.id} contactId={contact.id} onDone={closeForm} onCancel={closeForm} />}
          </div>
        )}

        <div className="mb-4 space-y-2">
          <SearchBox value={search} onSubmit={setSearch} placeholder="Search by contact or method…" />
          {search && !isLoading && (
            <p className="text-[12px] text-[var(--text-muted)]">
              {total} {total === 1 ? 'result' : 'results'} for “{search}”
            </p>
          )}
        </div>

        {isLoading ? (
          <PageLoader />
        ) : payments.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No payments yet.'}</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => {
              const isRefund = payment.kind === 'refund'
              return (
                <div
                  key={payment.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openPayment(payment)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openPayment(payment)
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{payment.contact_name ?? 'Unknown contact'}</p>
                    <p className="text-[11.5px] text-[var(--text-muted)]">
                      {payment.mop} ·{' '}
                      {payment.payment_date
                        ? new Date(payment.payment_date).toLocaleDateString(undefined, { timeZone: 'UTC' })
                        : new Date(payment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="font-mono-num text-[14px] font-semibold text-[var(--text-h)]">
                      {isRefund ? '−' : ''}
                      {payment.currency} {formatMoney(payment.amount)}
                    </span>
                    {isRefund ? (
                      <Badge tone="error">Refund</Badge>
                    ) : (
                      <Badge tone={payment.status === 1 ? 'success' : 'warning'}>{payment.status === 1 ? 'Paid' : 'Voided'}</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
