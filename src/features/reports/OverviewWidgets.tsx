import { useState } from 'react'
import { Link } from 'react-router-dom'
import { rupees, pct } from '@/features/performance/performanceUtils'
import { useSubscriberGrowth, useTeamPerformance } from './reportQueries'
import { AchievedBar, MonthSwitcher, QueryState } from './reportParts'
import { chipClass } from './reportStyles'

const box = 'space-y-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]'

/** Target against collected for one month, per person with a target. */
export function TargetAchievedWidget() {
  const [period, setPeriod] = useState(() => ({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }))
  const query = useTeamPerformance(period.month, period.year)
  const rows = (query.data?.staff ?? []).filter((s) => s.target).sort((a, b) => b.collected - a.collected)
  const target = rows.reduce((sum, s) => sum + (s.target?.target_amount ?? 0), 0)
  const collected = rows.reduce((sum, s) => sum + s.collected, 0)

  return (
    <section className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--text-h)]">Target achieved</h2>
        <MonthSwitcher month={period.month} year={period.year} onChange={(month, year) => setPeriod({ month, year })} />
      </div>
      <QueryState query={query} empty={rows.length === 0 ? 'No targets set for this month.' : null}>
        <div>
          <p className="mb-1.5 text-[12.5px] text-[var(--text-muted)]">
            <span className="font-mono-num text-[18px] font-semibold text-[var(--text-h)]">{rupees(collected)}</span> of {rupees(target)} ({pct(collected, target)}%)
          </p>
          <AchievedBar collected={collected} target={target || null} />
        </div>
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {rows.map((s) => (
            <li key={s.staff_id}>
              <Link to={`/admin/performance/${s.staff_id}?month=${period.month}&year=${period.year}&tab=achievements`} className="block">
                <span className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="truncate font-medium text-[var(--text-h)]">{s.name}</span>
                  <span className="shrink-0 font-mono-num text-[var(--text-muted)]">
                    {rupees(s.collected)} / {rupees(s.target?.target_amount ?? 0)}
                  </span>
                </span>
                <AchievedBar collected={s.collected} target={s.target?.target_amount ?? null} />
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </section>
  )
}

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
] as const

export function SubscriberGrowthWidget() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')
  const query = useSubscriberGrowth(range)
  const points = query.data ?? []
  const totals = points.map((p) => p.total)
  const min = Math.min(...totals)
  const spread = Math.max(...totals) - min || 1
  // The trend line in a 100 x 40 box, stretched to the card's width.
  const line = points.map((p, i) => `${points.length > 1 ? (i / (points.length - 1)) * 100 : 50},${38 - ((p.total - min) / spread) * 36}`).join(' ')

  return (
    <section className={box}>
      <h2 className="text-[15px] font-semibold text-[var(--text-h)]">Subscriber growth</h2>
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button key={r.value} type="button" aria-pressed={range === r.value} onClick={() => setRange(r.value)} className={chipClass(range === r.value)}>
            {r.label}
          </button>
        ))}
      </div>
      <QueryState query={query} empty={points.length === 0 ? 'Nothing to show yet.' : null}>
        <dl className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total', value: points[points.length - 1]?.total ?? 0 },
            { label: 'Gained', value: points.reduce((sum, p) => sum + p.gained, 0) },
            { label: 'Dropped', value: points.reduce((sum, p) => sum + p.dropped, 0) },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-[var(--surface-hover)] px-2 py-1.5">
              <dd className="font-mono-num text-[16px] font-semibold text-[var(--text-h)]">{f.value.toLocaleString()}</dd>
              <dt className="text-[11px] text-[var(--text-muted)]">{f.label}</dt>
            </div>
          ))}
        </dl>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Total subscribers over the period" className="h-24 w-full">
          <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
      </QueryState>
    </section>
  )
}
