import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { todayKeyIn } from './schedulingUi'

// A month calendar keyed by 'YYYY-MM-DD' day strings in one time zone; only the days in `enabledDays` can be tapped.

interface MonthGridProps {
  /** 'YYYY-MM-01' of the month shown */
  month: string
  timezone: string
  /** days that can be tapped (the ones with a free time) */
  enabledDays: Set<string>
  selected: string | null
  onSelect: (day: string) => void
  onMonthChange: (month: string) => void
}

const HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10)
}

export const monthStartOf = (day: string): string => `${day.slice(0, 7)}-01`

export function MonthGrid({ month, timezone, enabledDays, selected, onSelect, onMonthChange }: MonthGridProps) {
  const [y, m] = month.split('-').map(Number)
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const today = todayKeyIn(timezone)

  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
          <ChevronLeft size={16} />
        </button>
        <p className="text-[13.5px] font-semibold text-[var(--text-h)]">{monthTitle(month)}</p>
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {HEADERS.map((h) => (
          <div key={h} className="py-1">
            {h}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} />
          const clickable = enabledDays.has(day) && day >= today
          const isSelected = selected === day
          return (
            <button
              key={day}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(day)}
              className={cn(
                'flex h-10 items-center justify-center rounded-lg text-[13px] transition-colors',
                isSelected && 'bg-[var(--accent)] font-semibold text-[var(--ink)]',
                !isSelected && clickable && 'border border-[var(--accent-border)] text-[var(--accent-strong)] hover:bg-[var(--accent-bg)]',
                !clickable && 'text-[var(--text-muted)] opacity-40',
                day === today && !isSelected && 'ring-1 ring-[var(--accent-border)]',
              )}
            >
              {Number(day.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
