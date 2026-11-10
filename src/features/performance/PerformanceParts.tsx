import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pct } from './performanceUtils'

export function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  onClick,
  to,
  active,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  tone?: 'success' | 'warning' | 'error'
  onClick?: () => void
  /** Makes the tile a link to another page. */
  to?: string
  active?: boolean
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
        <Icon size={13} className="shrink-0" /> <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          'mt-1.5 font-display text-[20px] font-semibold leading-none tabular-nums',
          tone === 'success' ? 'text-[var(--success)]' : tone === 'warning' ? 'text-[var(--warning)]' : tone === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-h)]',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{sub}</p>}
    </>
  )
  const box = cn(
    'min-w-0 rounded-xl border bg-[var(--surface)] p-3 text-left shadow-[var(--shadow-sm)]',
    active ? 'border-[var(--accent)]' : 'border-[var(--border)]',
  )
  if (to) {
    return (
      <Link to={to} className={cn(box, 'block hover:bg-[var(--surface-hover)]')}>
        {body}
      </Link>
    )
  }
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(box, 'hover:bg-[var(--surface-hover)]')}>
      {body}
    </button>
  ) : (
    <div className={box}>{body}</div>
  )
}

export const STAGE_COLORS: Record<string, string> = {
  New: '#64748b',
  Aware: '#3b82f6',
  Opportunity: '#8b5cf6',
  Decision: '#f59e0b',
  Converted: '#16a34a',
  Rejected: '#dc2626',
  'No status': '#cbd5e1',
}

export function Card({ title, icon: Icon, children, action }: { title: string; icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]">
          <Icon size={15} />
        </span>
        <h2 className="min-w-0 flex-1 font-display text-[14px] font-semibold text-[var(--text-h)]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}


/** Current leads by pipeline stage as one stacked bar with a small legend. */
export function PipelineBar({ pipeline, stages }: { pipeline: Record<string, number>; stages: string[] }) {
  const order = [...stages, 'No status'].filter((stage) => pipeline[stage])
  const total = order.reduce((sum, stage) => sum + pipeline[stage], 0)
  if (total === 0) return <span className="text-[12px] text-[var(--text-muted)]">No leads assigned</span>
  return (
    <div title={order.map((stage) => `${stage}: ${pipeline[stage]}`).join(', ')}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-hover)]" role="img" aria-label="Leads by pipeline stage">
        {order.map((stage) => (
          <div key={stage} style={{ width: `${pct(pipeline[stage], total)}%`, background: STAGE_COLORS[stage] ?? '#94a3b8' }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {order.map((stage) => (
          <span key={stage} className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLORS[stage] ?? '#94a3b8' }} />
            {stage} <span className="font-semibold tabular-nums text-[var(--text-h)]">{pipeline[stage]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
