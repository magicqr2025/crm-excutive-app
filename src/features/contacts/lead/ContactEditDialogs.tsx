import { type FormEvent, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { CountryCodeInput } from '@/components/ui/CountryCodeInput'
import { useToast } from '@/components/ui/useToast'
import { useQuickEditLead, useSetLeadAltPhone } from '@/api/queries'
import type { CrmLead } from '@/api/crmApi'
import { DEFAULT_COUNTRY_CODE } from '@/data/countryCodes'
import { checkPhone } from '@/lib/phoneLength'
import { validateEmail } from '@/lib/leadValidation'
import { useContactAccess } from './useContactAccess'

// Taller touch targets on a phone; 16px text stops the phone zooming in on focus.
const FIELD = 'h-11 text-[16px] sm:h-10 sm:text-sm'
const LOCKED = 'disabled:cursor-not-allowed disabled:!bg-[var(--surface-hover)] disabled:!text-[var(--text-muted)]'

interface ContactDialogProps {
  lead: CrmLead
  onClose: () => void
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

/**
 * The contact's details: name and email, the number (an admin's to change), and the alternative number while
 * the person may still change it. Mount it only while open, so it starts from the saved values.
 */
export function EditContactSheet({ lead, onClose }: ContactDialogProps) {
  const { isAdmin, canChangeAlt } = useContactAccess(lead)
  const quickEditLead = useQuickEditLead()
  const setAltPhone = useSetLeadAltPhone()
  const { show } = useToast()

  const savedPhone = lead.contact_phone ?? ''
  const savedCode = lead.contact_country_code ?? DEFAULT_COUNTRY_CODE
  const savedEmail = lead.contact_email ?? ''
  const savedAlt = lead.contact_alt_phone ?? ''

  const [name, setName] = useState(lead.contact_name ?? '')
  const [email, setEmail] = useState(savedEmail)
  const [countryCode, setCountryCode] = useState(savedCode)
  const [mobile, setMobile] = useState(savedPhone)
  const [altMobile, setAltMobile] = useState(savedAlt)
  const [saving, setSaving] = useState(false)

  // Only a changed value is checked, so an older contact with an odd number or email can still be saved.
  const phoneChanged = isAdmin && (mobile !== savedPhone || countryCode !== savedCode)
  const phoneCheck = checkPhone(mobile, countryCode)
  const phoneError = phoneChanged && !phoneCheck.valid ? (mobile ? phoneCheck.message : 'Enter a mobile number') : undefined
  const emailChanged = email.trim() !== savedEmail
  const emailError = emailChanged ? validateEmail(email) : undefined
  const nameError = name.trim() ? undefined : 'Name is required'
  const valid = !nameError && !phoneError && !emailError

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      // First, so a number that belongs to another lead stops the save before anything else changes.
      if (canChangeAlt && altMobile !== savedAlt) await setAltPhone.mutateAsync({ leadId: lead.id, altPhone: altMobile || null })
      await quickEditLead.mutateAsync({
        id: lead.id,
        contactId: lead.contact_id,
        name: name.trim(),
        // An emptied box removes the email.
        ...(emailChanged ? { email: email.trim() || null } : {}),
        ...(phoneChanged ? { phone: phoneCheck.national, countryCode } : {}),
      })
      show({ title: 'Contact updated', tone: 'success' })
      onClose()
    } catch (error) {
      show({ title: errorText(error, 'Could not update the contact'), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} variant="sheet">
      <Dialog.Header>
        <Dialog.Title>Edit contact</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <Dialog.Body className="min-h-0 space-y-3">
          <Field label="Name *" error={nameError}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name" className={FIELD} />
          </Field>
          <Field label="Email" error={emailError}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email" className={FIELD} />
          </Field>
          <Field label="Mobile Number" error={phoneError} hint={isAdmin ? undefined : 'Only an admin can change this number.'}>
            <div className="flex items-center gap-2">
              <CountryCodeInput value={countryCode} onChange={setCountryCode} disabled={!isAdmin} className="!w-[92px] shrink-0 [&_input]:h-11 sm:[&_input]:h-10 [&_img]:!top-[15px] sm:[&_img]:!top-[13px]" />
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                disabled={!isAdmin}
                aria-label="Mobile number"
                inputMode="numeric"
                className={`${FIELD} ${LOCKED} min-w-0 flex-1`}
              />
            </div>
          </Field>
          <Field label="Alternative Number" hint={canChangeAlt && !isAdmin ? 'Check it before saving. Only an admin can change it afterwards.' : undefined}>
            <Input
              value={altMobile}
              onChange={(e) => setAltMobile(e.target.value.replace(/\D/g, ''))}
              disabled={!canChangeAlt}
              placeholder={canChangeAlt ? 'Enter alternative number (optional)' : 'Not added'}
              inputMode="numeric"
              className={`${FIELD} ${LOCKED}`}
            />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="submit" className="w-full justify-center" disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  )
}

/** Adds the alternative number; an admin can also change or remove a saved one. Mount it only while open. */
export function AltNumberSheet({ lead, onClose }: ContactDialogProps) {
  const { isAdmin } = useContactAccess(lead)
  const save = useSetLeadAltPhone()
  const { show } = useToast()
  const current = lead.contact_alt_phone ?? ''
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string>()

  function write(next: string | null) {
    setError(undefined)
    save.mutate(
      { leadId: lead.id, altPhone: next },
      {
        onSuccess: () => {
          show({ title: next ? 'Alternative number saved' : 'Alternative number removed', tone: 'success' })
          onClose()
        },
        onError: (err) => setError(errorText(err, 'Could not save the number')),
      },
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (value && value !== current && !save.isPending) write(value)
  }

  return (
    <Dialog open onClose={onClose} variant="sheet">
      <Dialog.Header>
        <Dialog.Title>{current ? 'Change alternative number' : 'Add alternative number'}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <Dialog.Body className="min-h-0">
          <Field label="Alternative number" error={error} hint={isAdmin ? undefined : 'Check it before saving. Only an admin can change it afterwards.'}>
            <Input
              autoFocus
              inputMode="numeric"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.replace(/\D/g, ''))
                setError(undefined)
              }}
              placeholder="e.g. 9876543210"
              className={FIELD}
            />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          {isAdmin && current && (
            <Button type="button" variant="outline" disabled={save.isPending} onClick={() => write(null)}>
              Remove
            </Button>
          )}
          <Button type="submit" className="flex-1 justify-center" disabled={!value || value === current || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save number'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  )
}
