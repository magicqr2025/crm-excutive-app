import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { formatDate } from '@/lib/dateFormat'
import { cn } from '@/lib/utils'
import { pct, rupees } from '@/features/performance/performanceUtils'
import { chipClass } from '@/features/reports/reportStyles'
import { NO_STAGE_ID, type FunnelRow } from './dashboardData'
import type { ReportStatus } from './performanceData'

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14.5px] font-semibold text-[var(--text-h)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A headline number. It is a link only where another page shows what it counts. */
export function Headline({ icon: Icon, label, value, hint, change, alert, to }: { icon: LucideIcon; label: string; value: string; hint: string; change?: number | null; alert?: boolean; to?: string }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
        <Icon size={13} aria-hidden className="shrink-0" /> <span className="truncate">{label}</span>
      </span>
      <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono-num text-[21px] font-semibold leading-tight text-[var(--text-h)]">{value}</span>
        {change !== undefined && change !== null && change !== 0 && (
          <span className={cn('text-[11.5px] font-semibold', change > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]')}>
            {change > 0 ? '+' : ''}
            {Math.round(change)}%
          </span>
        )}
      </span>
      <span className={cn('mt-0.5 block text-[11.5px]', alert ? 'font-medium text-[var(--error)]' : 'text-[var(--text-muted)]')}>{hint}</span>
    </>
  )
  const box = 'block min-w-0 rounded-xl bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]'
  return to ? (
    <Link to={to} className={cn(box, 'hover:bg-[var(--surface-hover)]')}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}

/** Bars for the stages; tapping a stage shows how its leads split across statuses. */
export function StageFunnel({ rows, total, statuses, byStatus }: { rows: FunnelRow[]; total: number; statuses: (ReportStatus & { sequence?: number | null })[]; byStatus: Map<string, number> }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const widest = Math.max(1, ...rows.map((r) => r.count))
  if (rows.length === 0) return <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">No stages to show.</p>

  return (
    <ul className="space-y-1.5">
      {rows.map((row) => {
        const open = openId === row.id
        const inStage = statuses.filter((s) => s.stage_id === row.id).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        const color = row.id === NO_STAGE_ID ? 'var(--text-muted)' : /reject/i.test(row.label) ? 'var(--error)' : /convert/i.test(row.label) ? 'var(--success)' : 'var(--accent)'
        return (
          <li key={row.id}>
            <button
              type="button"
              disabled={row.id === NO_STAGE_ID}
              aria-expanded={row.id === NO_STAGE_ID ? undefined : open}
              onClick={() => setOpenId(open ? null : row.id)}
              className="block w-full rounded-lg px-1.5 py-1.5 text-left enabled:hover:bg-[var(--surface-hover)]"
            >
              <span className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-medium text-[var(--text-h)]">{row.label}</span>
                <span className="shrink-0 font-mono-num text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-h)]">{row.count.toLocaleString()}</span> · {pct(row.count, total)}%
                </span>
              </span>
              <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <span className="block h-full rounded-full" style={{ width: `${(row.count / widest) * 100}%`, background: color }} />
              </span>
              {row.movedOn !== null && <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{row.movedOn}% moved on from the stage before</span>}
            </button>
            {open && (
              <ul className="mb-1 ml-3 space-y-1 border-l border-[var(--border)] pl-3">
                {inStage.length === 0 && <li className="text-[12.5px] text-[var(--text-muted)]">No statuses in this stage.</li>}
                {inStage.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 text-[12.5px]">
                    <span className="truncate text-[var(--text)]">{s.lead_status}</span>
                    <span className="shrink-0 font-mono-num font-semibold text-[var(--text-h)]">{byStatus.get(s.id) ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Leads added or money received per day, as plain bars. Tap a bar to read its day. */
export function TrendBars({ days, leads, revenue }: { days: string[]; leads: number[]; revenue: number[] }) {
  const [tab, setTab] = useState<'leads' | 'payments'>('leads')
  const [picked, setPicked] = useState<number | null>(null)
  const values = tab === 'leads' ? leads : revenue
  const show = (n: number) => (tab === 'leads' ? n.toLocaleString() : rupees(n))
  const total = values.reduce((sum, v) => sum + v, 0)
  const peak = Math.max(1, ...values.map(Math.abs))
  const index = picked !== null && picked < days.length ? picked : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          <span className="font-mono-num text-[18px] font-semibold text-[var(--text-h)]">{show(total)}</span> {tab === 'leads' ? 'leads added' : 'received'}
        </p>
        <div className="flex gap-1.5">
          {(['leads', 'payments'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t)
                setPicked(null)
              }}
              className={chipClass(tab === t)}
            >
              {t === 'leads' ? 'Leads' : 'Payments'}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${days.length} 100`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={tab === 'leads' ? 'Leads added per day' : 'Payments per day'}>
        {values.map((v, i) => {
          const height = (Math.abs(v) / peak) * 96
          return (
            <g key={days[i]} onClick={() => setPicked(i)} className="cursor-pointer">
              {/* The full-height strip makes a short bar easy to tap. */}
              <rect x={i} y={0} width={1} height={100} fill={index === i ? 'var(--surface-hover)' : 'transparent'} />
              <rect x={i + 0.12} y={100 - height} width={0.76} height={height} fill={v < 0 ? 'var(--error)' : 'var(--accent)'} />
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
        <span>{formatDate(days[0])}</span>
        <span>{formatDate(days[days.length - 1])}</span>
      </div>
      <p className="min-h-5 text-center text-[12.5px] text-[var(--text-h)]" aria-live="polite">
        {index === null ? <span className="text-[var(--text-muted)]">Tap a bar to see that day</span> : `${formatDate(days[index])}: ${show(values[index])}`}
      </p>
    </div>
  )
}
