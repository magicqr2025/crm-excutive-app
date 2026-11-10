import type { ReactNode } from 'react'
import { AlertTriangle, CalendarClock, CalendarPlus, CheckCircle2, XCircle } from 'lucide-react'
import type { MeetingView } from '@/api/crmApi'
import { cn } from '@/lib/utils'

interface CardDef {
  value: MeetingView
  label: string
  hint: string
  icon: ReactNode
  /** Icon chip colours. */
  chip: string
}

const CARDS: CardDef[] = [
  { value: 'all', label: 'Created', hint: 'All meetings in range', icon: <CalendarPlus size={16} />, chip: 'bg-[var(--surface-hover)] text-[var(--text)]' },
  { value: 'upcoming', label: 'Upcoming', hint: 'Scheduled, still ahead', icon: <CalendarClock size={16} />, chip: 'bg-[var(--accent-bg)] text-[var(--accent-strong)]' },
  { value: 'completed', label: 'Completed', hint: 'Held and closed out', icon: <CheckCircle2 size={16} />, chip: 'bg-[var(--success-bg)] text-[var(--success)]' },
  { value: 'overdue', label: 'Overdue', hint: 'Time passed, not completed', icon: <AlertTriangle size={16} />, chip: 'bg-[var(--error-bg)] text-[var(--error)]' },
  { value: 'cancelled', label: 'Cancelled', hint: 'Called off', icon: <XCircle size={16} />, chip: 'bg-[var(--warning-bg)] text-[var(--warning)]' },
]

export const MEETING_VIEW_LABEL: Record<MeetingView, string> = Object.fromEntries(CARDS.map((c) => [c.value, c.label])) as Record<MeetingView, string>

interface MeetingStatCardsProps {
  view: MeetingView
  counts?: Record<string, number>
  /** Tapping a card filters the list to it; tapping the active one goes back to "Created" (everything). */
  onSelect: (view: MeetingView) => void
}

export function MeetingStatCards({ view, counts, onSelect }: MeetingStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 pb-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => {
        const active = view === c.value
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? 'all' : c.value)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]',
              active ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)]',
            )}
          >
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', c.chip)}>{c.icon}</span>
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-[var(--text-muted)]">{c.label}</span>
              <span className="block font-display text-[20px] font-semibold leading-tight tabular-nums text-[var(--text-h)]">{counts ? (counts[c.value] ?? 0) : '–'}</span>
              <span className="block truncate text-[11px] text-[var(--text-muted)]">{c.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
