import { useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import type { ShareContactInput, ShareLocationInput } from '@/api/inboxApi'

// The chat's Location and Contact card forms. They only collect the values; ConversationPage sends
// them and shows any error. Each is mounted only while open, so it starts empty every time.

export function ShareLocationDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: ShareLocationInput) => void }) {
  const [mapsLink, setMapsLink] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState('')

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateError("This browser can't share its location.")
      return
    }
    setLocating(true)
    setLocateError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapsLink(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`)
        setLocating(false)
      },
      () => {
        setLocateError('Could not get your location — allow location access, or paste a Google Maps link.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const canSend = mapsLink.trim() !== ''

  function submit() {
    if (!canSend) return
    onSubmit({ mapsLink: mapsLink.trim(), name: name.trim() || undefined, address: address.trim() || undefined })
    onClose()
  }

  return (
    <Dialog open onClose={onClose}>
      <Dialog.Header>
        <Dialog.Title>Send location</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3.5">
        <Field label="Google Maps link or latitude, longitude *" hint="In Google Maps: open the place → Share → Copy link.">
          <Input value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} placeholder="https://maps.app.goo.gl/…  or  22.7196, 75.8577" />
        </Field>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent-strong)] disabled:opacity-60"
        >
          <LocateFixed size={15} /> {locating ? 'Getting your location…' : 'Use my current location'}
        </button>
        {locateError && <p className="text-[12px] text-[var(--error)]">{locateError}</p>}
        <Field label="Place name" hint="Optional.">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="e.g. MagicBolt Office" />
        </Field>
        <Field label="Address" hint="Optional.">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="e.g. Vijay Nagar, Indore" />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSend}>
          Send location
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}

const PHONE = /^\+?[\d\s()-]{6,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ShareContactDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: ShareContactInput) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const phoneBad = phone.trim() !== '' && !PHONE.test(phone.trim())
  const emailBad = email.trim() !== '' && !EMAIL.test(email.trim())
  const canSend = name.trim() !== '' && phone.trim() !== '' && !phoneBad && !emailBad

  function submit() {
    if (!canSend) return
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined })
    onClose()
  }

  return (
    <Dialog open onClose={onClose}>
      <Dialog.Header>
        <Dialog.Title>Send contact card</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3.5">
        <Field label="Name *">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Jp (Sales)" />
        </Field>
        <Field label="Phone number *" hint="With country code, e.g. +91 98765 43210." error={phoneBad ? 'Enter a valid phone number' : undefined}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91 98765 43210" />
        </Field>
        <Field label="Email" hint="Optional." error={emailBad ? 'Enter a valid email' : undefined}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@company.com" />
        </Field>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSend}>
          Send contact
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
