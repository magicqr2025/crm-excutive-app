import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { useActiveProducts, useCreateDeal, useCreateFollowup, useStaffList, useUpdateDeal } from '@/api/queries'
import type { CrmDeal, DealStatus } from '@/api/crmApi'
import { FollowupWhenPicker, initialWhen, resolveWhen, whenIsValid, type When } from '@/features/followups/FollowupWhenPicker'
import { useLeadUpdate, useSaveLeadChanges, type LeadField } from '@/features/followups/LeadUpdatePanel'
import { MeetingCreateForm } from '@/features/meetings/MeetingCreateForm'
import { SELECT_CLASS } from '@/features/meetings/meetingUi'
import { RecordPaymentForm } from '@/features/payments/RecordPaymentForm'
import { DEAL_STATUS_LABEL } from './leadConstants'

// The "add" forms on a lead's page. Each is a popup (full screen on a phone, a card on a tablet) and is only
// mounted while open, so it always starts empty.

const DEAL_STATUSES: DealStatus[] = ['created', 'accepted', 'canceled']

function staffLabel(s: { user_id: string; first_name: string | null; last_name: string | null }) {
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff #${s.user_id}`
}

/* ---------------- Follow-up ---------------- */

export function AddFollowupDialog({ open, onClose, contactId }: { open: boolean; onClose: () => void; contactId: string }) {
  return (
    <Dialog open={open} onClose={onClose}>
      {open && <FollowupForm contactId={contactId} onClose={onClose} />}
    </Dialog>
  )
}

function FollowupForm({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  // Only someone who sees the whole team can hand a follow-up to another person.
  const canAssign = useAuthStore((s) => s.isAdmin || s.seesAll)
  const { data: staff = [] } = useStaffList()
  const create = useCreateFollowup()
  const [when, setWhen] = useState<When>(initialWhen)
  const [assigneeId, setAssigneeId] = useState(userId)
  const [note, setNote] = useState('')

  function submit() {
    if (!whenIsValid(when) || !assigneeId) return
    const { date, time } = resolveWhen(when)
    create.mutate(
      { contactId, assignToStaffId: assigneeId, followupDate: date, followupTime: time, note: note.trim() || undefined },
      {
        onSuccess: () => {
          show({ title: 'Follow-up scheduled', tone: 'success' })
          onClose()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not schedule the follow-up', tone: 'error' }),
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Schedule follow-up</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        {canAssign && (
          <Field label="Assign to">
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={SELECT_CLASS}>
              {staff.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {staffLabel(s)}
                  {s.user_id === userId ? ' (me)' : ''}
                </option>
              ))}
              {!staff.some((s) => s.user_id === userId) && <option value={userId}>Me</option>}
            </select>
          </Field>
        )}
        <FollowupWhenPicker value={when} onChange={setWhen} />
        <Field label="Discussion" hint="Optional">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What was discussed, or what to cover on this call" />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!whenIsValid(when) || create.isPending}>
          {create.isPending ? 'Saving…' : 'Schedule follow-up'}
        </Button>
      </Dialog.Footer>
    </>
  )
}

/* ---------------- Deal ---------------- */

/** New deal, or edit `deal` when given. */
export function DealFormDialog({ open, onClose, contactId, deal }: { open: boolean; onClose: () => void; contactId: string; deal?: CrmDeal | null }) {
  return (
    <Dialog open={open} onClose={onClose}>
      {open && <DealForm key={deal?.id ?? 'new'} contactId={contactId} deal={deal ?? null} onClose={onClose} />}
    </Dialog>
  )
}

function DealForm({ contactId, deal, onClose }: { contactId: string; deal: CrmDeal | null; onClose: () => void }) {
  const { show } = useToast()
  const { data: products = [] } = useActiveProducts()
  const create = useCreateDeal()
  const update = useUpdateDeal()
  const [productId, setProductId] = useState(deal?.product_id ?? '')
  const [name, setName] = useState(deal?.deal_name ?? '')
  const [amount, setAmount] = useState(deal ? String(deal.deal_amount) : '')
  const [details, setDetails] = useState(deal?.deal_details ?? '')
  const [status, setStatus] = useState<DealStatus>(deal?.status ?? 'created')
  const saving = create.isPending || update.isPending
  const valid = name.trim() !== '' && amount !== '' && Number(amount) >= 0

  function pickProduct(id: string) {
    setProductId(id)
    const product = products.find((p) => p.id === id)
    if (!product) return
    // Fills the name and amount while they're still empty; both stay editable.
    if (!name.trim()) setName(product.name)
    if (!amount && product.selling_price > 0) setAmount(String(product.selling_price))
  }

  function fail(err: unknown) {
    show({ title: err instanceof Error ? err.message : 'Could not save the deal', tone: 'error' })
  }

  function submit() {
    if (!valid) return
    if (deal) {
      update.mutate(
        {
          id: deal.id,
          patch: { dealName: name.trim(), dealAmount: Number(amount), dealDetails: details.trim(), status, productId: productId || null },
        },
        {
          onSuccess: () => {
            show({ title: 'Deal updated', tone: 'success' })
            onClose()
          },
          onError: fail,
        },
      )
      return
    }
    create.mutate(
      { contactId, productId: productId || undefined, dealName: name.trim(), dealAmount: Number(amount), dealDetails: details.trim() || undefined },
      {
        // A new deal always starts "In progress" on the server; set any other status straight after.
        onSuccess: async (created) => {
          if (status !== 'created') {
            try {
              await update.mutateAsync({ id: created.id, patch: { status } })
            } catch (err) {
              show({ title: 'Deal added, but its status was not saved', description: err instanceof Error ? err.message : undefined, tone: 'error' })
              onClose()
              return
            }
          }
          show({ title: 'Deal added', tone: 'success' })
          onClose()
        },
        onError: fail,
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>{deal ? 'Edit deal' : 'New deal'}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <Field label="Product" hint="Picking one fills the name and price">
          <select value={productId} onChange={(e) => pickProduct(e.target.value)} className={SELECT_CLASS}>
            <option value="">No product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deal name *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Annual plan" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹) *">
            <Input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as DealStatus)} className={SELECT_CLASS}>
              {DEAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DEAL_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Details" hint="Optional">
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="What the client is buying, terms, notes" />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid || saving}>
          {saving ? 'Saving…' : deal ? 'Save changes' : 'Add deal'}
        </Button>
      </Dialog.Footer>
    </>
  )
}

/* ---------------- Meeting ---------------- */

export function AddMeetingDialog({ open, onClose, contactId }: { open: boolean; onClose: () => void; contactId: string }) {
  return (
    <Dialog open={open} onClose={onClose}>
      {open && (
        <>
          <Dialog.Header>
            <Dialog.Title>Schedule meeting</Dialog.Title>
            <Dialog.CloseButton onClose={onClose} />
          </Dialog.Header>
          <Dialog.Body>
            <MeetingCreateForm contactId={contactId} onDone={onClose} />
          </Dialog.Body>
        </>
      )}
    </Dialog>
  )
}

/* ---------------- Payment ---------------- */

export function AddPaymentDialog({ open, onClose, contactId }: { open: boolean; onClose: () => void; contactId: string }) {
  return (
    <Dialog open={open} onClose={onClose}>
      {open && (
        <>
          <Dialog.Header>
            <Dialog.Title>Add payment</Dialog.Title>
            <Dialog.CloseButton onClose={onClose} />
          </Dialog.Header>
          <Dialog.Body>
            <RecordPaymentForm contactId={contactId} onDone={onClose} onCancel={onClose} />
          </Dialog.Body>
        </>
      )}
    </Dialog>
  )
}

/* ---------------- One part of the lead: status, labels, groups, pipelines or products ---------------- */

const FIELD_TITLE: Record<LeadField, string> = {
  status: 'Edit stage & status',
  labels: 'Edit labels',
  groups: 'Edit groups',
  pipelines: 'Edit pipelines',
  products: 'Edit products',
}

const FIELD_SAVED: Record<LeadField, string> = {
  status: 'Status updated',
  labels: 'Labels updated',
  groups: 'Groups updated',
  pipelines: 'Pipelines updated',
  products: 'Products updated',
}

/** Opened from one tile's pencil (or the status chip): shows and saves only that part. `field` null = closed. */
export function EditLeadDialog({ field, onClose, leadId }: { field: LeadField | null; onClose: () => void; leadId: string }) {
  return (
    <Dialog open={field !== null} onClose={onClose}>
      {field && <EditLeadForm key={field} field={field} leadId={leadId} onClose={onClose} />}
    </Dialog>
  )
}

function EditLeadForm({ field, leadId, onClose }: { field: LeadField; leadId: string; onClose: () => void }) {
  const { show } = useToast()
  const { panel, changes, invalid } = useLeadUpdate(leadId, false, { only: field })
  const save = useSaveLeadChanges()
  const [saving, setSaving] = useState(false)

  async function submit() {
    const c = changes()
    if (!c) return onClose()
    setSaving(true)
    const failed = await save(c)
    setSaving(false)
    if (failed.length > 0) {
      show({ title: `Could not save ${failed.join(', ')}`, tone: 'error' })
      return
    }
    show({ title: FIELD_SAVED[field], tone: 'success' })
    onClose()
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>{FIELD_TITLE[field]}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body>{panel}</Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={invalid || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
