import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'

interface SearchBoxProps {
  /** The search currently applied to the list ('' = none). */
  value: string
  placeholder?: string
  onSubmit: (query: string) => void
}

// Runs the search only on Enter or the search button, not while typing. The ×
// button, or submitting an empty box, clears it and the list returns to its
// normal first page.
export function SearchBox({ value, placeholder = 'Search…', onSubmit }: SearchBoxProps) {
  const [draft, setDraft] = useState(value)

  // The applied value can change from outside (e.g. tab switch resets it).
  useEffect(() => setDraft(value), [value])

  function submit() {
    onSubmit(draft.trim())
  }

  function clear() {
    setDraft('')
    onSubmit('')
  }

  return (
    <form
      role="search"
      className="relative max-w-sm"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <button
        type="submit"
        aria-label="Search"
        className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-h)]"
      >
        <Search size={14} />
      </button>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="pl-8 pr-9"
      />
      {(draft || value) && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-h)]"
        >
          <X size={14} />
        </button>
      )}
    </form>
  )
}
