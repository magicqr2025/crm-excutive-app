import { useState } from 'react'
import { Target } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { useMyTarget } from '@/api/queries'
import { useAuthStore } from '@/store/useAuthStore'
import { TargetView } from './TargetView'

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }))

const SELECT_CLASSES =
  'h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] outline-none transition-colors focus:border-[var(--accent-border)]'

export function TargetPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const name = useAuthStore((s) => s.user?.name) || 'You'
  const { data: target, isLoading } = useMyTarget(month, year)
  const monthLabel = `${MONTHS[month - 1]} ${year}`

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        title="My target"
        subtitle="Your monthly target, pay and incentive."
        action={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${SELECT_CLASSES} min-w-0 flex-1`} aria-label="Month">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <div className="w-24 shrink-0">
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} aria-label="Year" />
            </div>
          </div>
        }
      />

      <div className="px-4 pb-6 pt-4 md:px-6">
        {isLoading ? (
          <PageLoader label="Loading your target…" />
        ) : target ? (
          <TargetView target={target} month={month} year={year} monthLabel={monthLabel} name={name} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)]">
              <Target size={22} />
            </span>
            <p className="text-[14px] font-semibold text-[var(--text-h)]">No target set for {monthLabel}</p>
            <p className="max-w-sm text-[13px] text-[var(--text-muted)]">Your admin sets a monthly target and incentive slabs. It will show up here once it’s added.</p>
          </div>
        )}
      </div>
    </div>
  )
}
