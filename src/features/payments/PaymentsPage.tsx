import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, X, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { usePaymentsPage, useCreatePayment, useUpdatePayment } from '@/api/queries'
import type { CrmContact, CrmPayment } from '@/api/crmApi'

const MOP_OPTIONS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function todayDateInput() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, in the viewer's local calendar day
}

export function PaymentsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { items: payments, total, summary, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = usePaymentsPage(search)
  const createPayment = useCreatePayment()
  const updatePayment = useUpdatePayment()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [mop, setMop] = useState(MOP_OPTIONS[0])
  const [notes, setNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayDateInput())

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editStatus, setEditStatus] = useState<0 | 1>(1)

  function resetForm() {
    setContact(null)
    setAmount('')
    setCurrency('INR')
    setMop(MOP_OPTIONS[0])
    setNotes('')
    setPaymentDate(todayDateInput())
  }

  function submit() {
    if (!contact || !amount) return
    createPayment.mutate(
      { contactId: contact.id, amount: Number(amount), currency, mop, notes: notes.trim() || undefined, paymentDate: paymentDate || undefined },
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

  function startEdit(payment: CrmPayment) {
    setEditingId(payment.id)
    setEditAmount(String(payment.amount))
    setEditStatus(payment.status)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit() {
    if (!editingId || !editAmount) return
    updatePayment.mutate(
      { id: editingId, patch: { amount: Number(editAmount), status: editStatus } },
      {
        onSuccess: () => {
          show({ title: 'Payment updated', tone: 'success' })
          setEditingId(null)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update payment', tone: 'error' }),
      },
    )
  }

  const successAmount = summary?.success_amount ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Payments"
        subtitle={`${total} payment${total === 1 ? '' : 's'} · ${formatMoney(successAmount)} collected`}
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
            <Button className="w-full justify-center" onClick={submit} disabled={!contact || !amount || createPayment.isPending}>
              {createPayment.isPending ? 'Saving…' : 'Save Payment'}
            </Button>
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
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No payments yet.'}</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) =>
              editingId === payment.id ? (
                <div key={payment.id} className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                  <Field label="Amount">
                    <Input type="number" inputMode="decimal" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                  </Field>
                  <Field label="Status">
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(Number(e.target.value) as 0 | 1)}
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
                    >
                      <option value={1}>Paid</option>
                      <option value={0}>Pending</option>
                    </select>
                  </Field>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={cancelEdit}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 justify-center"
                      onClick={saveEdit}
                      disabled={!editAmount || updatePayment.isPending}
                    >
                      {updatePayment.isPending ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              ) : (
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
                      {payment.currency} {formatMoney(payment.amount)}
                    </span>
                    <Badge tone={payment.status === 1 ? 'success' : 'warning'}>{payment.status === 1 ? 'Paid' : 'Pending'}</Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(payment)
                      }}
                      title="Edit payment"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
