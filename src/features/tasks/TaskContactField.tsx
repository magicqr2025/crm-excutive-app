import { useState } from 'react'
import { ContactPicker } from '@/components/ui/ContactPicker'
import type { CrmContact } from '@/api/crmApi'

interface TaskContactFieldProps {
  /** Called with the chosen contact's id, or '' when cleared. */
  onChange: (contactId: string) => void
  /** Starts with this client already chosen (a task added from a lead's page). */
  initial?: CrmContact | null
}

export function TaskContactField({ onChange, initial = null }: TaskContactFieldProps) {
  const [contact, setContact] = useState<CrmContact | null>(initial)
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
