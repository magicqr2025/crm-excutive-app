import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

/** The value that stands for "has none" (no label, no group, …) in a multi-select's list of picks. */
export const NONE_VALUE = '__none__'

interface MultiSelectFieldProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  /** Shown while nothing is picked, e.g. "Any label". */
  allLabel: string
  /** Adds a first choice for "has none", e.g. "No label". Leave out for fields where that makes no sense. */
  noneLabel?: string
  searchPlaceholder?: string
}

/**
 * A field that opens a checklist below itself: pick any number of values, optionally together with
 * "has none". The picks show as chips in the field; the list has a search box once it is long.
 * It opens inline rather than as a floating menu, so it works inside a dialog without clipping.
 */
export function MultiSelectField({ options, value, onChange, allLabel, noneLabel, searchPlaceholder = 'Search…' }: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const labelOf = (v: string) => (v === NONE_VALUE ? (noneLabel ?? 'None') : (options.find((o) => o.value === v)?.label ?? v))
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options), [options, q])
  const showNone = noneLabel !== undefined && (!q || noneLabel.toLowerCase().includes(q))

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])

  const row = (v: string, label: string, italic = false) => {
    const checked = value.includes(v)
    return (
      <li key={v}>
        <button
          type="button"
          onClick={() => toggle(v)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
        >
          <span
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
              checked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--surface)]',
            )}
          >
            {checked && <Check size={11} strokeWidth={3} />}
          </span>
          <span className={cn('min-w-0 flex-1 truncate', italic && 'italic text-[var(--text-muted)]')}>{label}</span>
        </button>
      </li>
    )
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-10 w-full items-center gap-2 rounded-lg border bg-[var(--bg)] px-3 py-1.5 text-left text-sm outline-none transition-[border-color,box-shadow]',
          open ? 'border-[var(--accent-border)] ring-3 ring-[var(--accent-bg)]' : 'border-[var(--border)]',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-[var(--text-muted)]">{allLabel}</span>
          ) : (
            value.map((v) => (
              <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--accent-border)] bg-[var(--accent-bg)] py-0.5 pl-2 pr-1 text-[12px] font-medium text-[var(--accent-strong)]">
                <span className="truncate">{labelOf(v)}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${labelOf(v)}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(v)
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded hover:bg-black/10"
                >
                  <X size={11} />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown size={15} className={cn('shrink-0 text-[var(--text-muted)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {options.length > 6 && (
            <div className="relative border-b border-[var(--border)]">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full bg-transparent pl-8 pr-3 text-[13px] text-[var(--text-h)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          )}
          <ul className="scrollbar-thin max-h-48 overflow-y-auto py-1">
            {showNone && row(NONE_VALUE, noneLabel!, true)}
            {shown.map((o) => row(o.value, o.label))}
            {!showNone && shown.length === 0 && <li className="px-3 py-2 text-[12.5px] text-[var(--text-muted)]">Nothing matches “{query}”.</li>}
          </ul>
          {value.length > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-muted)]">
              <span>{value.length} selected</span>
              <button type="button" onClick={() => onChange([])} className="font-medium text-[var(--accent-strong)] hover:underline">
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
