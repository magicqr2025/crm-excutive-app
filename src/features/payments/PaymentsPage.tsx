import { PageLoader } from '@/components/ui/Spinner'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useDeals, useMyTargets, usePaymentsPage, usePendingSubscriptions } from '@/api/queries'
import type { CrmContact, CrmPayment } from '@/api/crmApi'
import { RecordPaymentForm } from './RecordPaymentForm'

const MOP_FILTERS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }),
}))
const SELECT_CLASSES =
  'h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] outline-none transition-colors focus:border-[var(--accent-border)]'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const todayInput = () => new Date().toLocaleDateString('en-CA')
const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'error' }) {
  const color = tone === 'success' ? 'text-[var(--success)]' : tone === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-h)]'
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] px-3 py-2.5">
      <p className="truncate text-[11.5px] text-[var(--text-muted)]">{label}</p>
      <p className={`font-mono-num truncate text-[16px] font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex w-full items-center gap-1 rounded-lg border border-[var(--border)] p-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={
            value === item.value
              ? 'flex-1 whitespace-nowrap rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)]'
              : 'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// The chosen month's progress, measured on money actually received (not deal value).
function TargetStrip({ month, year }: { month: number; year: number }) {
  const { data: targets } = useMyTargets()
  const current = targets?.find((t) => t.target_year === year && t.target_month === month)
  if (!current || current.target_amount <= 0) return null
  const pct = Math.max(0, Math.min(100, Math.round((current.achieved_amount / current.target_amount) * 100)))
  const left = Math.max(0, current.target_amount - current.achieved_amount)
  return (
    <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-bg)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-[var(--text-h)]">My target</p>
        <p className="font-mono-num text-[13px] text-[var(--text-h)]">
          {inr(current.achieved_amount)} <span className="text-[var(--text-muted)]">/ {inr(current.target_amount)}</span>
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[12px] text-[var(--text-muted)]">
        {left > 0 ? `${inr(left)} left to collect. ` : 'Target reached. '}
        Only money received counts.
        {current.pending_amount > 0 && ` ${inr(current.pending_amount)} is still due on deals you closed this month.`}
      </p>
    </div>
  )
}

interface PendingRow {
  key: string
  contactId: string
  client: string
  label: string
  total: number
  received: number
  balance: number
  expected: string | null
  expectedLabel: string
  reason: string | null
  subscriptionId?: string
}

export function PaymentsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const now = new Date()
  const { show } = useToast()

  const [tab, setTab] = useState<'payments' | 'pending'>('payments')
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [mop, setMop] = useState('')
  const [kind, setKind] = useState<'' | 'payment' | 'refund'>('')
  const { items: payments, total, summary, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = usePaymentsPage({
    search: search || undefined,
    month,
    year,
    mop: mop || undefined,
    kind: kind || undefined,
  })
  const { data: dealsData, isLoading: dealsLoading } = useDeals()
  // Subscriptions sold straight from the payment form have no deal, so they are listed separately.
  const { data: pendingSubs = [], isLoading: subsLoading } = usePendingSubscriptions()

  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)
  // Set when "Log payment" is tapped on a pending deal — the client is already known.
  const [dealContactId, setDealContactId] = useState<string | null>(null)
  // Set too when it was a pending subscription, so the form opens on it.
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState<string | undefined>(undefined)
  const formContactId = dealContactId ?? contact?.id ?? null

  function closeForm() {
    setContact(null)
    setDealContactId(null)
    setPendingSubscriptionId(undefined)
    setFormOpen(false)
  }

  function logForPending(row: PendingRow) {
    setDealContactId(row.contactId)
    setPendingSubscriptionId(row.subscriptionId)
    setContact(null)
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openPayment(payment: CrmPayment) {
    // Contact pages are keyed by lead id; the API gives each payment its contact's latest lead.
    if (!payment.lead_id) {
      show({ title: "This payment's contact isn't in your contacts", tone: 'error' })
      return
    }
    navigate(`/contacts/${payment.lead_id}?tab=payment`)
  }

  const pendingDeals = (dealsData?.deals ?? []).filter((d) => d.status !== 'canceled' && d.balance_amount > 0)
  // One list for both: unpaid deals and unpaid subscriptions, soonest due first.
  const pending: PendingRow[] = [
    ...pendingDeals.map(
      (d): PendingRow => ({
        key: 'deal-' + d.id,
        contactId: d.contact_id,
        client: d.contact_name ?? 'Unknown client',
        label: d.deal_name,
        total: d.deal_amount,
        received: d.net_paid_amount,
        balance: d.balance_amount,
        expected: d.expected_balance_date ? d.expected_balance_date.slice(0, 10) : null,
        expectedLabel: 'Expected by',
        reason: d.short_payment_reason ?? null,
      }),
    ),
    ...pendingSubs.map(
      (s): PendingRow => ({
        key: 'sub-' + s.id,
        contactId: s.contact_id,
        client: s.name ?? 'Unknown client',
        label: 'Subscription: ' + (s.product_name ?? 'Subscription'),
        total: s.amount ?? 0,
        received: s.paid_amount,
        balance: s.balance ?? 0,
        // A subscription is due by the time its term ends.
        expected: s.end_date,
        expectedLabel: 'Term ends',
        reason: null,
        subscriptionId: s.id,
      }),
    ),
  ].sort((a, b) => (a.expected ?? '9999').localeCompare(b.expected ?? '9999'))
  const pendingTotal = pending.reduce((sum, r) => sum + r.balance, 0)
  const today = todayInput()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Payments"
        subtitle={`${inr(summary?.success_amount ?? 0)} collected`}
        action={
          <Button size="sm" onClick={() => (formOpen ? closeForm() : setFormOpen(true))} className="gap-1.5">
            {formOpen ? <X size={14} /> : <Plus size={14} />}
            {formOpen ? 'Close' : 'Log Payment'}
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        {formOpen && (
          <div className="space-y-3">
            {dealContactId ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Logging a payment for <span className="font-semibold text-[var(--text-h)]">{pending.find((r) => r.contactId === dealContactId)?.client ?? 'this client'}</span>
              </p>
            ) : (
              <Field label="Contact">
                <ContactPicker value={contact} onChange={setContact} />
              </Field>
            )}
            {formContactId && <RecordPaymentForm key={formContactId + (pendingSubscriptionId ?? '')} contactId={formContactId} defaultSubscriptionId={pendingSubscriptionId} onDone={closeForm} onCancel={closeForm} />}
          </div>
        )}

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'payments', label: 'All payments' },
            { value: 'pending', label: `Pending${pending.length ? ` (${pending.length})` : ''}` },
          ]}
        />

        <TargetStrip month={month} year={year} />

        {tab === 'pending' ? (
          <div className="space-y-3">
            <Stat label={`Still to collect · ${pending.length} item${pending.length === 1 ? '' : 's'}`} value={inr(pendingTotal)} />
            {dealsLoading || subsLoading ? (
              <PageLoader />
            ) : pending.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">Nothing pending — every deal and subscription is paid in full.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((row) => {
                  const overdue = row.expected !== null && row.expected < today
                  return (
                    <div key={row.key} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{row.client}</p>
                          <p className="truncate text-[12px] text-[var(--text-muted)]">{row.label}</p>
                        </div>
                        <p className="font-mono-num shrink-0 text-[14px] font-semibold text-[var(--warning)]">{inr(row.balance)}</p>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        Received {inr(row.received)} of {inr(row.total)}
                      </p>
                      {row.expected && (
                        <p className={`mt-0.5 text-[12px] ${overdue ? 'font-medium text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                          {row.expectedLabel} {dateText(row.expected)}
                          {overdue && ' · overdue'}
                        </p>
                      )}
                      {row.reason && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{row.reason}</p>}
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => logForPending(row)}>
                        Log payment
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Net collected" value={inr(summary?.success_amount ?? 0)} tone="success" />
              <Stat label="Payments received" value={inr(summary?.received_amount ?? 0)} />
              <Stat label="Refunds" value={inr(summary?.refunded_amount ?? 0)} tone="error" />
              <Stat label="Entries" value={total.toLocaleString()} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={SELECT_CLASSES} aria-label="Month">
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} aria-label="Year" />
              <select value={mop} onChange={(e) => setMop(e.target.value)} className={SELECT_CLASSES} aria-label="Payment mode">
                <option value="">All modes</option>
                {MOP_FILTERS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select value={kind} onChange={(e) => setKind(e.target.value as '' | 'payment' | 'refund')} className={SELECT_CLASSES} aria-label="Type">
                <option value="">Payments & refunds</option>
                <option value="payment">Payments only</option>
                <option value="refund">Refunds only</option>
              </select>
            </div>

            <div className="space-y-2">
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
              <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No payments match these filters.'}</p>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => {
                  const isRefund = payment.kind === 'refund'
                  const voided = payment.status !== 1 && !isRefund
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
                        <p className="truncate text-[11.5px] text-[var(--text-muted)]">
                          {payment.subscription_name ? `Subscription: ${payment.subscription_name} · ` : ''}
                          {payment.mop} · {dateText(payment.payment_date ?? payment.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`font-mono-num text-[14px] font-semibold ${isRefund ? 'text-[var(--error)]' : 'text-[var(--text-h)]'} ${voided ? 'line-through opacity-60' : ''}`}
                        >
                          {isRefund ? '−' : ''}
                          {inr(payment.amount)}
                        </span>
                        {isRefund ? <Badge tone="error">Refund</Badge> : <Badge tone={voided ? 'warning' : 'success'}>{voided ? 'Voided' : 'Paid'}</Badge>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
          </>
        )}
      </div>
    </div>
  )
}
