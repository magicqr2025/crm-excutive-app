import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { CountryCodeInput } from '@/components/ui/CountryCodeInput'
import { MultiSelectField } from '@/components/ui/MultiSelectField'
import { useToast } from '@/components/ui/useToast'
import { useActiveProducts, useClaimLead, useLeadStageTypes, useLeadStatuses, useMyLeadCampaigns, useQuickCreateLead } from '@/api/queries'
import { useCan } from '@/store/useAuthStore'
import { checkPhone } from '@/lib/phoneLength'
import { duplicateLeadInfo, type DuplicateLeadInfo } from '@/api/crmApi'
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/data/countryCodes'
import { normalizeMobileInput, validateEmail, validateMobile } from '@/lib/leadValidation'

// Native selects: on a phone they open the system picker, which is the easiest list to tap.
const SELECT_CLASSES =
  'h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[16px] sm:h-10 sm:text-sm text-[var(--text-h)] outline-none transition-colors focus:border-[var(--accent-border)]'

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
  const { data: allStatuses = [] } = useLeadStatuses()
  const { data: stageTypes = [] } = useLeadStageTypes()
  const canViewProducts = useCan('products')
  const { data: products = [], isLoading: loadingProducts } = useActiveProducts(canViewProducts)
  const { data: campaigns = [] } = useMyLeadCampaigns()
  const quickCreateLead = useQuickCreateLead()
  const claimLead = useClaimLead()

  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  // null = not touched yet, so the default below applies; '' = deliberately none.
  const [pickedStatusId, setLeadStatusId] = useState<string | null>(null)
  const [pickedStageId, setPickedStageId] = useState('')
  const [productIds, setProductIds] = useState<string[]>([])
  const [pickedCampaignId, setLeadCampaignId] = useState('')
  const [duplicate, setDuplicate] = useState<DuplicateLeadInfo | null>(null)
  // Most executives are on a single campaign — pre-pick it.
  const leadCampaignId = pickedCampaignId || (campaigns.length === 1 ? campaigns[0].id : '')

  // Statuses switched off in the main CRM aren't offered.
  const leadStatuses = allStatuses
    .filter((s) => s.status === undefined || s.status === '1')
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  // As in the main CRM, a new lead starts at the "New" stage's default status.
  const defaultStatusId = leadStatuses.find(
    (s) => s.is_default && stageTypes.some((t) => t.id === s.stage_id && t.lead_stage.trim().toLowerCase() === 'new'),
  )?.id
  const leadStatusId = pickedStatusId ?? defaultStatusId ?? ''
  const stageId = leadStatuses.find((s) => s.id === leadStatusId)?.stage_id ?? pickedStageId
  const stageStatuses = stageId ? leadStatuses.filter((s) => s.stage_id === stageId) : leadStatuses

  // Picking a stage moves the status to that stage's default (else its first), so the two always agree.
  function changeStage(nextStageId: string) {
    const inStage = leadStatuses.filter((s) => s.stage_id === nextStageId)
    setPickedStageId(nextStageId)
    setLeadStatusId((inStage.find((s) => s.is_default) ?? inStage[0])?.id ?? '')
  }

  // A field's error shows once it's been left (blur) or after a submit attempt.
  const [touched, setTouched] = useState<Record<'name' | 'mobile' | 'email', boolean>>({ name: false, mobile: false, email: false })
  const [submitted, setSubmitted] = useState(false)
  const touch = (field: keyof typeof touched) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }))

  const errors = {
    name: name.trim() ? undefined : 'Name is required',
    mobile: validateMobile(countryCode, mobile),
    email: validateEmail(email),
    campaign: leadCampaignId ? undefined : 'Pick a pipeline',
  }
  const valid = !errors.name && !errors.mobile && !errors.email && !errors.campaign
  const shown = (field: keyof typeof touched) => (submitted || touched[field] ? errors[field] : undefined)
  const phoneCheck = checkPhone(mobile, countryCode)
  // A number that is already too long is wrong straight away; a short one may just be unfinished.
  const maxDigits = COUNTRY_CODES.find((c) => c.code === countryCode)?.maxLength
  const mobileError = shown('mobile') ?? (maxDigits !== undefined && phoneCheck.national.length > maxDigits ? errors.mobile : undefined)

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
        phone: phoneCheck.national,
        countryCode: countryCode.trim() || undefined,
        email: email.trim() || undefined,
        leadStatusId: leadStatusId || undefined,
        leadCampaignId,
        ...(canViewProducts && productIds.length ? { productIds } : {}),
      },
      {
        onSuccess: (lead) => {
          show({ title: 'Lead added successfully', tone: 'success' })
          // Straight to the calling screen (Call button, timeline, disposition
          // form) so the executive can dial right away. Not auto-dialed: a call
          // still takes an explicit tap on Call.
          onClose()
          navigate(`/campaigns/${leadCampaignId}/call/${lead.id}`)
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
    <Dialog open onClose={onClose} className="sm:max-w-2xl">
      <Dialog.Header>
        <Dialog.Title>Add New Lead</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      {/* One column on a phone, two from tablet width. */}
      <Dialog.Body className="grid min-h-0 flex-1 grid-cols-1 content-start gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field label="Name *" error={shown('name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')} placeholder="Enter name" className="h-11 text-[16px] sm:h-10 sm:text-sm" autoFocus />
        </Field>
        <Field label="Mobile Number *" error={mobileError}>
          <div className="flex items-center gap-2">
            <CountryCodeInput value={countryCode} onChange={setCountryCode} className="!w-[92px] shrink-0 [&_input]:h-11 sm:[&_input]:h-10 [&_img]:!top-[15px] sm:[&_img]:!top-[13px]" />
            <Input
              value={mobile}
              onChange={(e) => {
                setMobile(normalizeMobileInput(e.target.value))
                setDuplicate(null)
              }}
              onBlur={() => touch('mobile')}
              placeholder="Enter mobile number"
              inputMode="numeric"
              className="h-11 min-w-0 flex-1 text-[16px] sm:h-10 sm:text-sm"
            />
          </div>
        </Field>
        {duplicate && (
          <div className="sm:col-span-2">
            <DuplicateNotice info={duplicate} onOpen={openContact} onAssign={assignToMe} assigning={claimLead.isPending} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Email" error={shown('email')}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch('email')} placeholder="Enter email" className="h-11 text-[16px] sm:h-10 sm:text-sm" />
          </Field>
        </div>
        <Field label="Lead Stage">
          <select value={stageId} onChange={(e) => changeStage(e.target.value)} className={SELECT_CLASSES}>
            <option value="">All stages</option>
            {stageTypes.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.lead_stage}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lead Status" hint={stageId && stageStatuses.length === 0 ? 'This stage has no statuses yet.' : undefined}>
          <select
            value={leadStatusId}
            onChange={(e) => {
              // Keeps the stage in place if the status is then cleared.
              setPickedStageId(stageId)
              setLeadStatusId(e.target.value)
            }}
            className={SELECT_CLASSES}
          >
            <option value="">Select lead status</option>
            {stageStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.lead_status}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Pipeline *"
          hint={campaigns.length === 0 ? "You're not on any pipeline yet — ask your admin to add you to one." : undefined}
          error={submitted && campaigns.length > 0 ? errors.campaign : undefined}
        >
          <select value={leadCampaignId} onChange={(e) => setLeadCampaignId(e.target.value)} className={SELECT_CLASSES}>
            <option value="">Select pipeline</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </Field>
        {canViewProducts && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-[var(--text-h)]">Product</p>
            <MultiSelectField
              value={productIds}
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setProductIds}
              allLabel="Select product"
              searchPlaceholder="Search product"
            />
            {!loadingProducts && products.length === 0 && (
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">No active products yet.</p>
            )}
          </div>
        )}
        <p className="text-[12px] text-[var(--text-muted)] sm:col-span-2">This lead will be assigned to you.</p>
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
