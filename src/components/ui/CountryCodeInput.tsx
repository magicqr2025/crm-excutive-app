import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { registerDropdownOpen, unregisterDropdownOpen } from '@/lib/dropdownRegistry'
import { usePopoverPosition } from './usePopoverPosition'
import { COUNTRY_CODES, countryForDialCode } from '@/data/countryCodes'
import { CountryFlag } from './CountryFlag'

interface CountryCodeInputProps {
  value: string
  onChange: (code: string) => void
  className?: string
  /** Shown greyed out and cannot be changed. */
  disabled?: boolean
}

// Combobox, not a plain <select> — the country list is long enough that
// scanning it is slow, so typing narrows it (by name or digits) while still
// letting someone who already knows the code just type it directly.
export function CountryCodeInput({ value, onChange, className, disabled }: CountryCodeInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  // What the person has typed since opening. Kept apart from the box's text, which
  // starts as the selected code and must not narrow the list by itself.
  const [search, setSearch] = useState('')
  // Several countries share a code (US and Canada are both 1), so remember which one was
  // picked; otherwise the first country with the code supplies the flag.
  const [pickedIso, setPickedIso] = useState('')
  const selected = COUNTRY_CODES.find((c) => c.iso === pickedIso && c.code === value) ?? countryForDialCode(value)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const position = usePopoverPosition(anchorRef, panelRef, open, 'start')
  const closeSelf = useRef(() => setOpen(false)).current

  useEffect(() => {
    if (!open) {
      setQuery(value)
      setSearch('')
    }
  }, [value, open])

  useEffect(() => {
    if (open) {
      registerDropdownOpen(closeSelf)
    } else {
      unregisterDropdownOpen(closeSelf)
    }
    return () => unregisterDropdownOpen(closeSelf)
  }, [open, closeSelf])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const term = search.trim().toLowerCase()
  const digits = term.replace(/\D/g, '')
  const filtered = term
    ? COUNTRY_CODES.filter((c) => c.name.toLowerCase().includes(term) || (digits !== '' && c.code.includes(digits)))
    : COUNTRY_CODES

  function handleChange(raw: string) {
    setQuery(raw)
    setSearch(raw)
    setOpen(true)
    if (/^\d*$/.test(raw)) onChange(raw.slice(0, 4))
  }

  function selectCountry(code: string, iso: string) {
    setPickedIso(iso)
    onChange(code)
    setQuery(code)
    setOpen(false)
  }

  return (
    <div ref={anchorRef} className={cn('relative', className)}>
      <input
        value={query}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        // Selected on click, so typing a name replaces the code instead of adding to it.
        onClick={(e) => {
          e.currentTarget.select()
          setOpen(true)
        }}
        placeholder="91"
        className={cn(
          'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-h)] outline-none transition-colors focus:border-[var(--accent-border)] disabled:cursor-not-allowed disabled:!bg-[var(--surface-hover)] disabled:text-[var(--text-muted)]',
          // Left-aligned beside a flag, so the code sits right next to it.
          selected ? 'pl-[34px] pr-2 text-left' : 'px-3 text-center',
        )}
      />
      {selected && <CountryFlag iso={selected.iso} className="pointer-events-none absolute left-2.5 top-[13px]" />}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="z-50 max-h-64 w-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12.5px] text-[var(--text-muted)]">No match — you can still type a custom code</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={`${c.name}-${c.code}`}
                  type="button"
                  onClick={() => selectCountry(c.code, c.iso)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-hover)]',
                    c.iso === selected?.iso ? 'text-[var(--accent-strong)]' : 'text-[var(--text)]',
                  )}
                >
                  <CountryFlag iso={c.iso} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 text-[var(--text-muted)]">{c.code}</span>
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
