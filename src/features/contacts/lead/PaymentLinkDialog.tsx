import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useToast } from '@/components/ui/useToast'
import { useSchedulingProfile } from '@/api/queries'
import { createPaymentLink, fetchPaymentSetup, type PaymentLinkRow } from '@/api/collectApi'
import { SELECT_CLASS } from '@/features/meetings/meetingUi'
import { publicBookingOrigin } from '@/features/meetings/schedulingUi'
import { buildWhatsAppNumber } from '@/lib/whatsapp'
import { copyText, shareLink } from '@/lib/share'

// Ported from orm-whatsapp's CreatePaymentLinkDialog, for one client: make a payment link for an amount, then
// copy, share or WhatsApp it. The pay page is served by the admin web app on the business's own domain.

type ExpiryChoice = 'default' | '24' | '168' | '720' | 'never' | 'date'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

interface PaymentLinkDialogProps {
  open: boolean
  onClose: () => void
  contactId: string
  contactName: string
  phone: string | null
  countryCode?: string | null
}

export function PaymentLinkDialog(props: PaymentLinkDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose}>
      {props.open && <PaymentLinkForm {...props} />}
    </Dialog>
  )
}

function PaymentLinkForm({ onClose, contactId, contactName, phone, countryCode }: PaymentLinkDialogProps) {
  const { show } = useToast()
  const queryClient = useQueryClient()
  const { data: setup } = useQuery({ queryKey: ['collect', 'setup'], queryFn: fetchPaymentSetup })
  const { data: profile } = useSchedulingProfile()
  const create = useMutation({ mutationFn: createPaymentLink, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collect'] }) })
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [expiry, setExpiry] = useState<ExpiryChoice>('default')
  const [expiryDate, setExpiryDate] = useState('')
  const [created, setCreated] = useState<PaymentLinkRow | null>(null)
  const [copied, setCopied] = useState(false)

  const hours = setup?.default_expiry_hours ?? 48
  const notReady = setup !== undefined && (!setup?.enabled || !(setup.upi_id || setup.account_number))

  function expiryHours(): number | null | undefined {
    if (expiry === 'default') return undefined
    if (expiry === 'never') return null
    if (expiry === 'date') {
      const end = new Date(`${expiryDate}T23:59:59`)
      return Math.max(1, Math.ceil((end.getTime() - Date.now()) / 3_600_000))
    }
    return Number(expiry)
  }

  function submit() {
    const amt = amount.trim() ? Number(amount) : undefined
    if (amt !== undefined && !(amt > 0)) return show({ title: 'Enter a valid amount', tone: 'error' })
    if (expiry === 'date' && !expiryDate) return show({ title: 'Pick the expiry date', tone: 'error' })
    create.mutate(
      { contact_id: contactId, amount: amt, note: note.trim() || undefined, expires_in_hours: expiryHours() },
      { onSuccess: setCreated, onError: (e) => show({ title: e instanceof Error ? e.message : 'Could not create the link', tone: 'error' }) },
    )
  }

  const url = created ? `${publicBookingOrigin(profile?.public_host)}/pay/l/${created.token}` : ''
  const message = `Hi ${contactName}, please complete your payment${created?.amount ? ` of ${inr(created.amount)}` : ''} using this secure link: ${url}`
  const waNumber = buildWhatsAppNumber({ phone, countryCode })

  async function copy() {
    if (await copyText(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else {
      show({ title: 'Could not copy. Select the link and copy it by hand.', tone: 'error' })
    }
  }

  async function share() {
    const result = await shareLink({ title: 'Payment link', text: message, url })
    if (result === 'copied') show({ title: 'Link copied', tone: 'success' })
    if (result === 'failed') show({ title: 'Could not share the link', tone: 'error' })
  }

  if (created) {
    return (
      <>
        <Dialog.Header>
          <Dialog.Title>Payment link ready</Dialog.Title>
          <Dialog.CloseButton onClose={onClose} />
        </Dialog.Header>
        <Dialog.Body className="space-y-4">
          <div className="rounded-xl bg-[var(--bg)] p-4 text-center">
            <p className="font-mono-num text-[24px] font-semibold text-[var(--text-h)]">{created.amount ? inr(created.amount) : 'Client enters the amount'}</p>
            <p className="text-[13px] text-[var(--text-muted)]">For {contactName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Payment link" />
            <Button variant="secondary" size="icon" onClick={copy} aria-label="Copy link">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <p className="text-[12.5px] text-[var(--text-muted)]">{created.expires_at ? `Expires ${new Date(created.expires_at).toLocaleString()}.` : 'This link does not expire.'}</p>
          <div className="grid grid-cols-2 gap-2">
            {waNumber && (
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-semibold text-white hover:brightness-95"
              >
                <WhatsAppIcon size={17} /> WhatsApp
              </a>
            )}
            <button type="button" onClick={share} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-[14px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]">
              <Share2 size={16} /> Share
            </button>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <a href={url} target="_blank" rel="noopener noreferrer" className="mr-auto inline-flex items-center gap-1 text-[13px] text-[var(--text-muted)] hover:text-[var(--accent-strong)]">
            Preview <ExternalLink size={13} />
          </a>
          <Button onClick={onClose}>Done</Button>
        </Dialog.Footer>
      </>
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Payment link</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        {notReady && (
          <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning)]">
            Payment details aren’t set up yet. An admin needs to add the UPI or bank details first.
          </p>
        )}
        <p className="text-[13px] text-[var(--text-muted)]">
          For <span className="font-medium text-[var(--text-h)]">{contactName}</span>
        </p>
        <Field label="Amount (₹)" hint="Leave empty to let the client type the amount.">
          <Input type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
        </Field>
        <Field label="Link expires">
          <select value={expiry} onChange={(e) => setExpiry(e.target.value as ExpiryChoice)} className={SELECT_CLASS}>
            <option value="default">Default ({hours} hours)</option>
            <option value="24">In 1 day</option>
            <option value="168">In 7 days</option>
            <option value="720">In 30 days</option>
            <option value="date">On a date…</option>
            <option value="never">Never</option>
          </select>
        </Field>
        {expiry === 'date' && (
          <Field label="Expiry date *">
            <Input type="date" min={new Date().toISOString().slice(0, 10)} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </Field>
        )}
        <Field label="Note for the client" hint="Optional">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Advance for the website project" maxLength={300} />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={create.isPending || notReady}>
          {create.isPending ? 'Creating…' : 'Create link'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
