import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useCreatePayment, useDeals, useMyTarget, usePaymentsPage } from '@/api/queries'
import type { CrmContact, CrmDeal, CrmPayment } from '@/api/crmApi'

const MOP_OPTIONS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }),
}))
const SELECT_CLASSES = 'h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

function formatMoney(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function todayDateInput() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, in the viewer's local calendar day
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'error' }) {
  const color = tone === 'success' ? 'text-[var(--success)]' : tone === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-h)]'
  return (
    <div className="rounded-xl border border-[var(--border)] px-3 py-2.5">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className={`font-mono-num text-[15px] font-semibold ${color}`}>₹{value}</p>
    </div>
  )
}

export function PaymentsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const now = new Date()
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
  const { data: myTarget } = useMyTarget(month, year)
  const { data: dealsData, isLoading: dealsLoading } = useDeals()
  const createPayment = useCreatePayment()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [formMop, setFormMop] = useState(MOP_OPTIONS[0])
  const [notes, setNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayDateInput())

  function resetForm() {
    setContact(null)
    setAmount('')
    setCurrency('INR')
    setFormMop(MOP_OPTIONS[0])
    setNotes('')
    setPaymentDate(todayDateInput())
  }

  function submit() {
    if (!contact || !amount) return
    createPayment.mutate(
      { contactId: contact.id, amount: Number(amount), currency, mop: formMop, notes: notes.trim() || undefined, paymentDate: paymentDate || undefined },
      {
        onSuccess: () => {
          show({ title: 'Payment logged', tone: 'success' })
          resetForm()
          setFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to log payment', tone: 'error' }),
      },
    )
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

  const pending = (dealsData?.deals ?? [])
    .filter((d) => d.status !== 'canceled' && (d.balance_amount ?? 0) > 0)
    .sort((a, b) => (a.expected_balance_date ?? '9999').localeCompare(b.expected_balance_date ?? '9999'))
  const pendingTotal = pending.reduce((sum, d) => sum + (d.balance_amount ?? 0), 0)
  const today = todayDateInput()

  function openDeal(deal: CrmDeal) {
    if (!deal.lead_id) {
      show({ title: "This deal's contact isn't in your contacts", tone: 'error' })
      return
    }
    navigate(`/contacts/${deal.lead_id}?tab=payment`)
  }

  const targetLeft = myTarget ? Math.max(0, myTarget.target_amount - myTarget.achieved_amount) : 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Payments"
        subtitle={`${total} payment${total === 1 ? '' : 's'} · ₹${formatMoney(summary?.success_amount ?? 0)} collected`}
        action={
          <Button size="sm" onClick={() => setFormOpen((v) => !v)} className="gap-1.5">
            {formOpen ? <X size={14} /> : <Plus size={14} />}
            {formOpen ? 'Close' : 'Log Payment'}
          </Button>
        }
      />
      <div className="p-4">
        {formOpen && (
          <div className="mb-4 space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <Field label="Contact">
              <ContactPicker value={contact} onChange={setContact} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Currency">
                <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
              </Field>
            </div>
            <Field label="Payment date">
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </Field>
            <Field label="Payment method">
              <select
                value={formMop}
                onChange={(e) => setFormMop(e.target.value)}
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
            <Button className="w-full justify-center" onClick={submit} disabled={!contact || !amount || createPayment.isPending}>
              {createPayment.isPending ? 'Saving…' : 'Save Payment'}
            </Button>
          </div>
        )}

        {myTarget && (
          <div className="mb-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] px-4 py-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['My target', myTarget.target_amount],
                  ['Achieved', myTarget.achieved_amount],
                  ['Target left', targetLeft],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
                  <p className="font-mono-num text-[15px] font-semibold text-[var(--text-h)]">₹{formatMoney(value)}</p>
                </div>
              ))}
            </div>
            <Link to="/target" className="mt-2 inline-block text-[12px] font-medium text-[var(--accent-strong)]">
              Full target view →
            </Link>
          </div>
        )}

        <div className="mb-4 inline-flex gap-1 rounded-lg border border-[var(--border)] p-1">
          {(
            [
              ['payments', 'All payments'],
              ['pending', `Pending balances${pending.length ? ` (${pending.length})` : ''}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? 'rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-white'
                  : 'rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)]'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'pending' ? (
          dealsLoading ? (
            <PageLoader />
          ) : pending.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">Nothing pending — every deal is paid in full.</p>
          ) : (
            <div className="space-y-2">
              <Stat label={`Still to collect across ${pending.length} deals`} value={formatMoney(pendingTotal)} />
              {pending.map((deal) => {
                const overdue = Boolean(deal.expected_balance_date) && deal.expected_balance_date!.slice(0, 10) < today
                return (
                  <div
                    key={deal.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDeal(deal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openDeal(deal)
                    }}
                    className="cursor-pointer rounded-lg border border-[var(--border)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{deal.contact_name ?? 'Unknown contact'}</p>
                      <span className="font-mono-num text-[14px] font-semibold text-[var(--warning)]">₹{formatMoney(deal.balance_amount ?? 0)}</span>
                    </div>
                    <p className="truncate text-[11.5px] text-[var(--text-muted)]">
                      {deal.deal_name} · ₹{formatMoney(deal.net_paid_amount ?? 0)} of ₹{formatMoney(deal.deal_amount)} received
                    </p>
                    {deal.expected_balance_date && (
                      <p className={`text-[11.5px] ${overdue ? 'font-medium text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                        Expected {new Date(deal.expected_balance_date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                        {overdue && ' · overdue'}
                      </p>
                    )}
                    {deal.short_payment_reason && <p className="truncate text-[11.5px] text-[var(--text-muted)]">Reason: {deal.short_payment_reason}</p>}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <Stat label="Net collected" value={formatMoney(summary?.success_amount ?? 0)} tone="success" />
              <Stat label="Received" value={formatMoney(summary?.received_amount ?? 0)} />
              <Stat label="Refunds" value={formatMoney(summary?.refunded_amount ?? 0)} tone="error" />
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex gap-2">
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={SELECT_CLASSES}>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="w-24 shrink-0">
                  <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} />
                </div>
              </div>
              <div className="flex gap-2">
                <select value={mop} onChange={(e) => setMop(e.target.value)} className={SELECT_CLASSES}>
                  <option value="">All modes</option>
                  {MOP_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select value={kind} onChange={(e) => setKind(e.target.value as '' | 'payment' | 'refund')} className={SELECT_CLASSES}>
                  <option value="">Payments & refunds</option>
                  <option value="payment">Payments only</option>
                  <option value="refund">Refunds only</option>
                </select>
              </div>
              <SearchBox value={search} onSubmit={setSearch} placeholder="Search by contact or method…" />
            </div>

            {isLoading ? (
              <PageLoader />
            ) : payments.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No payments in this period.'}</p>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => {
                  const isRefund = payment.kind === 'refund'
                  const voided = payment.status === 0
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
                          {payment.deal_name ? `${payment.deal_name} · ` : ''}
                          {payment.mop} ·{' '}
                          {payment.payment_date
                            ? new Date(payment.payment_date).toLocaleDateString(undefined, { timeZone: 'UTC' })
                            : new Date(payment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span
                          className={`font-mono-num text-[14px] font-semibold ${isRefund ? 'text-[var(--error)]' : 'text-[var(--text-h)]'} ${voided ? 'line-through opacity-60' : ''}`}
                        >
                          {isRefund ? '−' : ''}
                          {payment.currency} {formatMoney(payment.amount)}
                        </span>
                        {voided ? <Badge tone="warning">Voided</Badge> : isRefund ? <Badge tone="error">Refund</Badge> : <Badge tone="success">Paid</Badge>}
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
