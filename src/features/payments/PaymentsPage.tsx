import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { usePayments, useCreatePayment } from '@/api/queries'
import type { CrmContact } from '@/api/crmApi'

const MOP_OPTIONS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function PaymentsPage() {
  const { data, isLoading } = usePayments()
  const createPayment = useCreatePayment()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [mop, setMop] = useState(MOP_OPTIONS[0])
  const [notes, setNotes] = useState('')

  function resetForm() {
    setContact(null)
    setAmount('')
    setCurrency('INR')
    setMop(MOP_OPTIONS[0])
    setNotes('')
  }

  function submit() {
    if (!contact || !amount) return
    createPayment.mutate(
      { contactId: contact.id, amount: Number(amount), currency, mop, notes: notes.trim() || undefined },
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

  const payments = data?.payments ?? []
  const successAmount = data?.successAmount ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Payments"
        subtitle={`${payments.length} payment${payments.length === 1 ? '' : 's'} · ${formatMoney(successAmount)} collected`}
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

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{payment.contact_name ?? 'Unknown contact'}</p>
                  <p className="text-[11.5px] text-[var(--text-muted)]">
                    {payment.mop} · {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="font-mono-num text-[14px] font-semibold text-[var(--text-h)]">
                    {payment.currency} {formatMoney(payment.amount)}
                  </span>
                  <Badge tone={payment.status === 1 ? 'success' : 'warning'}>{payment.status === 1 ? 'Paid' : 'Pending'}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
