import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { CountryCodeInput } from '@/components/ui/CountryCodeInput'
import { useToast } from '@/components/ui/useToast'
import { useClaimLead, useLeadStatuses, useMyLeadCampaigns, useQuickCreateLead } from '@/api/queries'
import { duplicateLeadInfo, type DuplicateLeadInfo } from '@/api/crmApi'
import { DEFAULT_COUNTRY_CODE } from '@/data/countryCodes'
import { normalizeMobileInput, validateEmail, validateMobile } from '@/lib/leadValidation'

const SELECT_CLASSES =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] outline-none transition-colors focus:border-[var(--accent-border)]'

interface AddNewLeadDialogProps {
  onClose: () => void
}

// An executive's new lead is always their own (crmbackend enforces it), so
// unlike orm-whatsapp's admin dialog there's no assignee picker — only the
// campaigns they're an agent on are offered. Mount it only while open, so the
// form starts empty each time.
export function AddNewLeadDialog({ onClose }: AddNewLeadDialogProps) {
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: leadStatuses = [] } = useLeadStatuses()
  const { data: campaigns = [] } = useMyLeadCampaigns()
  const quickCreateLead = useQuickCreateLead()
  const claimLead = useClaimLead()

  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [leadStatusId, setLeadStatusId] = useState('')
  const [pickedCampaignId, setLeadCampaignId] = useState('')
  const [duplicate, setDuplicate] = useState<DuplicateLeadInfo | null>(null)
  // Most executives are on a single campaign — pre-pick it.
  const leadCampaignId = pickedCampaignId || (campaigns.length === 1 ? campaigns[0].id : '')

  // A field's error shows once it's been left (blur) or after a submit attempt.
  const [touched, setTouched] = useState<Record<'name' | 'mobile' | 'email', boolean>>({ name: false, mobile: false, email: false })
  const [submitted, setSubmitted] = useState(false)
  const touch = (field: keyof typeof touched) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }))

  const errors = {
    name: name.trim() ? undefined : 'Name is required',
    mobile: validateMobile(countryCode, mobile),
    email: validateEmail(email),
    campaign: leadCampaignId ? undefined : 'Pick a campaign',
  }
  const valid = !errors.name && !errors.mobile && !errors.email && !errors.campaign
  const shown = (field: keyof typeof touched) => (submitted || touched[field] ? errors[field] : undefined)

  function openContact(leadId: string) {
    onClose()
    navigate(`/contacts/${leadId}`)
  }

  function submit() {
    setSubmitted(true)
    if (!valid) return
    setDuplicate(null)
    quickCreateLead.mutate(
      {
        name: name.trim(),
        phone: mobile.trim(),
        countryCode: countryCode.trim() || undefined,
        email: email.trim() || undefined,
        leadStatusId: leadStatusId || undefined,
        leadCampaignId,
      },
      {
        onSuccess: (lead) => {
          show({ title: 'Lead added successfully', tone: 'success' })
          openContact(lead.id)
        },
        onError: (error) => {
          const info = duplicateLeadInfo(error)
          if (info) {
            setDuplicate(info)
            return
          }
          show({ title: error instanceof Error ? error.message : 'Failed to add lead', tone: 'error' })
        },
      },
    )
  }

  function assignToMe(leadId: string) {
    claimLead.mutate(leadId, {
      onSuccess: () => {
        show({ title: 'Lead assigned to you', tone: 'success' })
        openContact(leadId)
      },
      onError: (error) => {
        show({ title: error instanceof Error ? error.message : 'Failed to assign lead', tone: 'error' })
      },
    })
  }

  return (
    <Dialog open onClose={onClose}>
      <Dialog.Header>
        <Dialog.Title>Add New Lead</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3">
        <Field label="Name *" error={shown('name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')} placeholder="Enter name" autoFocus />
        </Field>
        <Field label="Mobile Number *" error={shown('mobile')}>
          <div className="flex items-center gap-2">
            <CountryCodeInput value={countryCode} onChange={setCountryCode} className="!w-20 shrink-0" />
            <Input
              value={mobile}
              onChange={(e) => {
                setMobile(normalizeMobileInput(e.target.value, countryCode))
                setDuplicate(null)
              }}
              onBlur={() => touch('mobile')}
              placeholder="Enter mobile number"
              inputMode="numeric"
              className="flex-1"
            />
          </div>
        </Field>
        {duplicate && <DuplicateNotice info={duplicate} onOpen={openContact} onAssign={assignToMe} assigning={claimLead.isPending} />}
        <Field label="Email" error={shown('email')}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch('email')} placeholder="Enter email" />
        </Field>
        <Field label="Lead Status">
          <select value={leadStatusId} onChange={(e) => setLeadStatusId(e.target.value)} className={SELECT_CLASSES}>
            <option value="">Select lead status</option>
            {leadStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.lead_status}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Campaign *"
          hint={campaigns.length === 0 ? "You're not on any campaign yet — ask your admin to add you to one." : undefined}
          error={submitted && campaigns.length > 0 ? errors.campaign : undefined}
        >
          <select value={leadCampaignId} onChange={(e) => setLeadCampaignId(e.target.value)} className={SELECT_CLASSES}>
            <option value="">Select campaign</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[12px] text-[var(--text-muted)]">This lead will be assigned to you.</p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button className="w-full justify-center" onClick={submit} disabled={quickCreateLead.isPending}>
          {quickCreateLead.isPending ? 'Adding…' : 'Add Lead'}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}

interface DuplicateNoticeProps {
  info: DuplicateLeadInfo
  onOpen: (leadId: string) => void
  onAssign: (leadId: string) => void
  assigning: boolean
}

function DuplicateNotice({ info, onOpen, onAssign, assigning }: DuplicateNoticeProps) {
  const message =
    info.owner === 'me'
      ? 'This number is already in your contacts.'
      : info.owner === 'unassigned'
        ? 'This number already exists and is not assigned to anyone.'
        : `This lead is already assigned to ${info.assignee_name || 'another executive'}.`

  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--warning)] bg-[var(--surface-hover)] px-3 py-2.5">
      <p className="text-[12.5px] font-medium text-[var(--text-h)]">{message}</p>
      {info.lead_id && info.owner === 'me' && (
        <Button size="sm" variant="outline" onClick={() => onOpen(info.lead_id as string)}>
          Open contact
        </Button>
      )}
      {info.lead_id && info.owner === 'unassigned' && (
        <Button size="sm" onClick={() => onAssign(info.lead_id as string)} disabled={assigning}>
          {assigning ? 'Assigning…' : 'Assign to me'}
        </Button>
      )}
    </div>
  )
}
