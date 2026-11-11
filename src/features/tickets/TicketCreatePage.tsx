import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ContactPicker } from '@/components/ui/ContactPicker'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useCreateTicket, useTicketMasters } from '@/api/queries'
import type { CrmContact } from '@/api/crmApi'
import type { TicketType } from '@/api/ticketsApi'
import { cn } from '@/lib/utils'
import { AttachmentPicker } from './TicketAttachments'
import { SELECT_CLASS, TICKET_TYPE_OPTIONS } from './ticketUi'

/** Raise a ticket: what it is about, a subject, category, details, an optional customer and attachments. */
export function TicketCreatePage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: categories = [] } = useTicketMasters('categories')
  const { data: products = [] } = useTicketMasters('products')
  const create = useCreateTicket()

  const [ticketType, setTicketType] = useState<TicketType>('issue')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [productId, setProductId] = useState('')
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [files, setFiles] = useState<File[]>([])

  const valid = subject.trim() !== '' && description.trim() !== '' && categoryId !== ''

  function submit() {
    if (!valid || create.isPending) return
    create.mutate(
      { subject: subject.trim(), description: description.trim(), ticketType, categoryId, productId: productId || undefined, contactId: contact?.id, files },
      {
        onSuccess: () => {
          show({ title: 'Ticket raised', tone: 'success' })
          navigate('/tickets', { replace: true })
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not raise the ticket', tone: 'error' }),
      },
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="New ticket"
        subtitle="Report an issue, an error, or ask for something"
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={14} /> Back
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-2xl space-y-5 p-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--text-h)]">What is this about?</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ticket type">
            {TICKET_TYPE_OPTIONS.map((o) => {
              const active = ticketType === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTicketType(o.value)}
                  className={cn('rounded-lg border px-3 py-2.5 text-left', active ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border)] hover:bg-[var(--surface-hover)]')}
                >
                  <span className={cn('block text-[13px] font-medium', active ? 'text-[var(--accent-strong)]' : 'text-[var(--text-h)]')}>{o.label}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-muted)]">{o.hint}</span>
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Subject *">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Short summary, e.g. Cannot send template messages" />
        </Field>

        <Field label="Category *">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={SELECT_CLASS}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {categories.length === 0 && <p className="-mt-3 text-[12px] text-[var(--warning)]">No categories yet — an admin needs to add some in the admin app first.</p>}

        <Field label="Page URL">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={SELECT_CLASS}>
            <option value="">Not sure / general</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Details *" hint="What happened, what you expected, and the steps to reproduce it.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} maxLength={10000} />
        </Field>

        <Field label="Customer" hint="Optional — link a contact this ticket is about.">
          <ContactPicker value={contact} onChange={setContact} />
        </Field>

        <Field label="Attachments" hint="Screenshots, PDF, Word, Excel, CSV or text. Up to 5 files, 5 MB each.">
          <AttachmentPicker files={files} onChange={setFiles} />
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/tickets')}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid || create.isPending} onClick={submit}>
            {create.isPending ? 'Raising…' : 'Raise ticket'}
          </Button>
        </div>
      </div>
    </div>
  )
}
