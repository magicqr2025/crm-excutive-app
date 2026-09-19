import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useDeals, useCreateDeal } from '@/api/queries'
import type { CrmContact, DealStatus } from '@/api/crmApi'

const STATUS_TONE: Record<DealStatus, 'success' | 'error' | 'accent'> = {
  accepted: 'success',
  canceled: 'error',
  created: 'accent',
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function DealsPage() {
  const { data, isLoading } = useDeals()
  const createDeal = useCreateDeal()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [dealName, setDealName] = useState('')
  const [dealAmount, setDealAmount] = useState('')
  const [dealDetails, setDealDetails] = useState('')

  function resetForm() {
    setContact(null)
    setDealName('')
    setDealAmount('')
    setDealDetails('')
  }

  function submit() {
    if (!contact || !dealName.trim() || !dealAmount) return
    createDeal.mutate(
      { contactId: contact.id, dealName: dealName.trim(), dealAmount: Number(dealAmount), dealDetails: dealDetails.trim() || undefined },
      {
        onSuccess: () => {
          show({ title: 'Deal added', tone: 'success' })
          resetForm()
          setFormOpen(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to add deal', tone: 'error' }),
      },
    )
  }

  const deals = data?.deals ?? []
  const totalAmount = data?.totalAmount ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Deals"
        subtitle={`${deals.length} deal${deals.length === 1 ? '' : 's'} · ${formatMoney(totalAmount)} total`}
        action={
          <Button size="sm" onClick={() => setFormOpen((v) => !v)} className="gap-1.5">
            {formOpen ? <X size={14} /> : <Plus size={14} />}
            {formOpen ? 'Close' : 'Add Deal'}
          </Button>
        }
      />
      <div className="p-4">
        {formOpen && (
          <div className="mb-4 space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <Field label="Contact">
              <ContactPicker value={contact} onChange={setContact} />
            </Field>
            <Field label="Deal name">
              <Input value={dealName} onChange={(e) => setDealName(e.target.value)} placeholder="e.g. Annual plan upgrade" />
            </Field>
            <Field label="Amount">
              <Input type="number" inputMode="decimal" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Details" hint="Optional">
              <Textarea value={dealDetails} onChange={(e) => setDealDetails(e.target.value)} rows={3} placeholder="Notes about this deal…" />
            </Field>
            <Button
              className="w-full justify-center"
              onClick={submit}
              disabled={!contact || !dealName.trim() || !dealAmount || createDeal.isPending}
            >
              {createDeal.isPending ? 'Saving…' : 'Save Deal'}
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : deals.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No deals yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <Card key={deal.id}>
                <Card.Body>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{deal.deal_name}</p>
                      <p className="truncate text-[12px] text-[var(--text-muted)]">{deal.contact_name ?? 'Unknown contact'}</p>
                    </div>
                    <Badge tone={STATUS_TONE[deal.status]}>{deal.status}</Badge>
                  </div>
                  <p className="mt-2.5 font-mono-num text-[17px] font-semibold text-[var(--accent-strong)]">{formatMoney(deal.deal_amount)}</p>
                  {deal.deal_details && <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{deal.deal_details}</p>}
                </Card.Body>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
