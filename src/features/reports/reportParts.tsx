import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { pct } from '@/features/performance/performanceUtils'

export function MonthSwitcher({ month, year, onChange }: { month: number; year: number; onChange: (month: number, year: number) => void }) {
  const shift = (by: number) => {
    const d = new Date(year, month - 1 + by, 1)
    onChange(d.getMonth() + 1, d.getFullYear())
  }
  const button = 'flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]'
  return (
    <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className={button}>
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[8.5rem] text-center text-[13px] font-medium text-[var(--text-h)]">
        {new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
      </span>
      <button type="button" onClick={() => shift(1)} aria-label="Next month" className={button}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

/** Collected as a share of the target. */
export function AchievedBar({ collected, target }: { collected: number; target: number | null }) {
  if (!target) return <p className="text-[12px] text-[var(--text-muted)]">No target set</p>
  const done = pct(collected, target)
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className={cn('h-full rounded-full', done >= 100 ? 'bg-[var(--success)]' : 'bg-[var(--accent)]')} style={{ width: `${Math.min(100, done)}%` }} />
      </div>
      <span className={cn('w-10 shrink-0 text-right font-mono-num text-[12px] font-semibold', done >= 100 ? 'text-[var(--success)]' : 'text-[var(--text-muted)]')}>{done}%</span>
    </div>
  )
}

/** Loading, error (with retry) and empty states, so every report block handles all three the same way. */
export function QueryState({
  query,
  empty,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  empty?: string | null
  children: ReactNode
}) {
  if (query.isLoading) return <PageLoader />
  if (query.isError) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p role="alert" className="text-[13px] text-[var(--error)]">
          {query.error instanceof Error ? query.error.message : 'Could not load this.'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  if (empty) return <p className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">{empty}</p>
  return <>{children}</>
}
