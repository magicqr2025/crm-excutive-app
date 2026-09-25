import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, X, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { useToast } from '@/components/ui/useToast'
import { useDealsPage, useCreateDeal, useUpdateDeal } from '@/api/queries'
import type { CrmContact, CrmDeal, DealStatus } from '@/api/crmApi'

const STATUS_TONE: Record<DealStatus, 'success' | 'error' | 'accent'> = {
  accepted: 'success',
  canceled: 'error',
  created: 'accent',
}

const STATUS_OPTIONS: DealStatus[] = ['created', 'accepted', 'canceled']

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function DealsPage() {
  const location = useLocation()
  const prefillContact = (location.state as { prefillContact?: CrmContact } | null)?.prefillContact ?? null
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { items: deals, total, summary, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useDealsPage(search)
  const createDeal = useCreateDeal()
  const updateDeal = useUpdateDeal()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(Boolean(prefillContact))
  const [contact, setContact] = useState<CrmContact | null>(prefillContact)
  const [dealName, setDealName] = useState('')
  const [dealAmount, setDealAmount] = useState('')
  const [dealDetails, setDealDetails] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDetails, setEditDetails] = useState('')
  const [editStatus, setEditStatus] = useState<DealStatus>('created')

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

  function openDeal(deal: CrmDeal) {
    // Contact pages are keyed by lead id; the API gives each deal its contact's latest lead.
    const leadId = deal.lead_id
    if (!leadId) {
      show({ title: "This deal's contact isn't in your contacts", tone: 'error' })
      return
    }
    navigate(`/contacts/${leadId}?tab=deal`)
  }

  function startEdit(deal: CrmDeal) {
    setEditingId(deal.id)
    setEditName(deal.deal_name)
    setEditAmount(String(deal.deal_amount))
    setEditDetails(deal.deal_details ?? '')
    setEditStatus(deal.status)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit() {
    if (!editingId || !editName.trim() || !editAmount) return
    updateDeal.mutate(
      {
        id: editingId,
        patch: { dealName: editName.trim(), dealAmount: Number(editAmount), dealDetails: editDetails.trim(), status: editStatus },
      },
      {
        onSuccess: () => {
          show({ title: 'Deal updated', tone: 'success' })
          setEditingId(null)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to update deal', tone: 'error' }),
      },
    )
  }

  const totalAmount = summary?.total_amount ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Deals"
        subtitle={`${total} deal${total === 1 ? '' : 's'} · ${formatMoney(totalAmount)} total`}
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

        <div className="mb-4 space-y-2">
          <SearchBox value={search} onSubmit={setSearch} placeholder="Search by deal or contact…" />
          {search && !isLoading && (
            <p className="text-[12px] text-[var(--text-muted)]">
              {total} {total === 1 ? 'result' : 'results'} for “{search}”
            </p>
          )}
        </div>

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : deals.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No deals yet.'}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) =>
              editingId === deal.id ? (
                <Card key={deal.id}>
                  <Card.Body>
                    <div className="space-y-3">
                      <Field label="Deal name">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </Field>
                      <Field label="Amount">
                        <Input type="number" inputMode="decimal" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                      </Field>
                      <Field label="Status">
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as DealStatus)}
                          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Details" hint="Optional">
                        <Textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} rows={2} />
                      </Field>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={cancelEdit}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 justify-center"
                          onClick={saveEdit}
                          disabled={!editName.trim() || !editAmount || updateDeal.isPending}
                        >
                          {updateDeal.isPending ? 'Saving…' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ) : (
                <Card
                  key={deal.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDeal(deal)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openDeal(deal)
                  }}
                  className="cursor-pointer hover:bg-[var(--surface-hover)]"
                >
                  <Card.Body>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{deal.deal_name}</p>
                        <p className="truncate text-[12px] text-[var(--text-muted)]">{deal.contact_name ?? 'Unknown contact'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={STATUS_TONE[deal.status]}>{deal.status}</Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(deal)
                          }}
                          title="Edit deal"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2.5 font-mono-num text-[17px] font-semibold text-[var(--accent-strong)]">{formatMoney(deal.deal_amount)}</p>
                    {deal.deal_details && <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{deal.deal_details}</p>}
                  </Card.Body>
                </Card>
              ),
            )}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
