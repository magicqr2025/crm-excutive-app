import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS, describeRange, withBasis, type MeetingRangeValue, type RangeBasis } from './meetingRange'

interface MeetingRangeBarProps {
  value: MeetingRangeValue
  onChange: (next: MeetingRangeValue) => void
}

const BASES: { value: RangeBasis; label: string }[] = [
  { value: 'meeting', label: 'Meeting date' },
  { value: 'created', label: 'Created on' },
]

// The page-wide date range, sized for a phone: which date it applies to, a scrolling row of chips,
// from/to fields for Custom, and a plain sentence saying what's shown.
export function MeetingRangeBar({ value, onChange }: MeetingRangeBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium text-[var(--text-muted)]">Based on</span>
        <div role="tablist" aria-label="Which date the range applies to" className="flex rounded-lg bg-[var(--surface-hover)] p-0.5">
          {BASES.map((b) => (
            <button
              key={b.value}
              type="button"
              role="tab"
              aria-selected={value.basis === b.value}
              onClick={() => value.basis !== b.value && onChange(withBasis(value, b.value))}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                value.basis === b.value ? 'bg-[var(--surface)] text-[var(--accent-strong)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wraps instead of scrolling sideways, so every chip is visible on a phone. */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Date range">
        {RANGE_PRESETS[value.basis].map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={value.preset === p.value}
            onClick={() => onChange({ ...value, preset: p.value })}
            className={cn(
              'h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium transition-colors sm:h-8 sm:px-3 sm:text-[12.5px]',
              value.preset === p.value
                ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="From"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="min-w-0 flex-1"
          />
          <span className="text-[12.5px] text-[var(--text-muted)]">to</span>
          <Input
            type="date"
            aria-label="To"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="min-w-0 flex-1"
          />
        </div>
      )}

      <p className="text-[12px] text-[var(--text-muted)]">{describeRange(value)}</p>
    </div>
  )
}
