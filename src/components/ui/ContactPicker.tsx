import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useContactSearch } from '@/api/queries'
import type { CrmContact } from '@/api/crmApi'

interface ContactPickerProps {
  value: CrmContact | null
  onChange: (contact: CrmContact | null) => void
}

export function ContactPicker({ value, onChange }: ContactPickerProps) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data: results = [], isFetching, isError } = useContactSearch(debounced)

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-h)]">{value.name}</p>
          {value.phone && <p className="font-mono-num text-[11.5px] text-[var(--text-muted)]">{value.phone}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a contact by name or phone…"
          className="pl-8"
        />
      </div>
      {debounced.trim().length > 1 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
          {isFetching ? (
            <p className="px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">Searching…</p>
          ) : isError ? (
            <p className="px-3 py-2.5 text-[12.5px] text-[var(--error)]">
              Couldn't search contacts — you may not have contacts access yet.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">No contacts found.</p>
          ) : (
            results.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  onChange(contact)
                  setSearch('')
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
              >
                <span className="text-[13px] font-medium text-[var(--text-h)]">{contact.name}</span>
                {contact.phone && <span className="font-mono-num text-[11.5px] text-[var(--text-muted)]">{contact.phone}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
