import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { registerDropdownOpen, unregisterDropdownOpen } from '@/lib/dropdownRegistry'
import { usePopoverPosition } from './usePopoverPosition'
import { COUNTRY_CODES } from '@/data/countryCodes'

interface CountryCodeInputProps {
  value: string
  onChange: (code: string) => void
  className?: string
}

// Combobox, not a plain <select> — the country list is long enough that
// scanning it is slow, so typing narrows it (by name or digits) while still
// letting someone who already knows the code just type it directly.
export function CountryCodeInput({ value, onChange, className }: CountryCodeInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const position = usePopoverPosition(anchorRef, panelRef, open, 'start')
  const closeSelf = useRef(() => setOpen(false)).current

  useEffect(() => {
    if (!open) setQuery(value)
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

  const filtered = query.trim()
    ? COUNTRY_CODES.filter(
        (c) => c.name.toLowerCase().includes(query.trim().toLowerCase()) || c.code.includes(query.replace(/\D/g, '')),
      )
    : COUNTRY_CODES

  function handleChange(raw: string) {
    setQuery(raw)
    if (/^\d*$/.test(raw)) onChange(raw.slice(0, 4))
  }

  function selectCode(code: string) {
    onChange(code)
    setQuery(code)
    setOpen(false)
  }

  return (
    <div ref={anchorRef} className={cn('relative', className)}>
      <input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="91"
        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-center text-sm text-[var(--text-h)] outline-none transition-colors focus:border-[var(--accent-border)]"
      />
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
                  onClick={() => selectCode(c.code)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-hover)]',
                    c.code === value ? 'text-[var(--accent-strong)]' : 'text-[var(--text)]',
                  )}
                >
                  <span className="truncate">{c.name}</span>
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
