import { useState } from 'react'
import { ContactPicker } from '@/components/ui/ContactPicker'
import type { CrmContact } from '@/api/crmApi'

interface TaskContactFieldProps {
  /** Called with the chosen contact's id, or '' when cleared. */
  onChange: (contactId: string) => void
}

export function TaskContactField({ onChange }: TaskContactFieldProps) {
  const [contact, setContact] = useState<CrmContact | null>(null)
  return (
    <ContactPicker
      value={contact}
      onChange={(next) => {
        setContact(next)
        onChange(next?.id ?? '')
      }}
    />
  )
}
