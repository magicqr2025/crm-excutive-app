import { Target } from 'lucide-react'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/useAuthStore'
import { useMySales, useMyTarget } from '@/api/queries'
import { formatDate } from '@/lib/dateFormat'
import { cn } from '@/lib/utils'
import { TargetView } from '@/features/target/TargetView'
import { rupees } from './performanceUtils'

const day = (iso: string | null) => (iso ? formatDate(iso) : '—')

function Section({ id, title, note, empty, children }: { id: string; title: string; note: string; empty: string | null; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="mb-2.5 text-[15px] font-semibold text-[var(--text-h)]">
        {title} <span className="text-[12.5px] font-normal text-[var(--text-muted)]">· {note}</span>
      </h2>
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {empty ? <p className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">{empty}</p> : <ul className="divide-y divide-[var(--border)] text-[13px]">{children}</ul>}
      </div>
    </section>
  )
}

/** The month's target, pay and incentive, then the deals closed and the money received. */
export function AchievementsTab({ month, year, monthLabel }: { month: number; year: number; monthLabel: string }) {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const name = useAuthStore((s) => s.user?.name) || 'You'
  const target = useMyTarget(month, year)
  const sales = useMySales(userId, month, year)

  if (target.isLoading || sales.isLoading) return <PageLoader label="Loading achievements…" />

  const deals = sales.data?.deals ?? []
  const payments = sales.data?.payments ?? []
  const booked = deals.reduce((s, d) => s + d.deal_amount, 0)
  const pending = deals.reduce((s, d) => s + d.pending_amount, 0)
  const collected = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="flex flex-col gap-5">
      {target.data ? (
        <TargetView target={target.data} month={month} year={year} monthLabel={monthLabel} name={name} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <Target size={20} />
          </span>
          <p className="text-[14px] font-semibold text-[var(--text-h)]">No target set for {monthLabel}</p>
          <p className="max-w-sm text-[13px] text-[var(--text-muted)]">Your admin sets a monthly target and incentive slabs. It will show up here once it’s added.</p>
        </div>
      )}

      <Section
        id="sales-closed"
        title="Sales closed"
        note={`${deals.length} deal${deals.length === 1 ? '' : 's'}, ${rupees(booked)} booked, ${rupees(pending)} still to collect`}
        empty={deals.length === 0 ? `No deals closed in ${monthLabel}.` : null}
      >
        {deals.map((d) => (
          <li key={d.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-[var(--text-h)]">{d.contact_name}</span>
              <span className="shrink-0 text-[11.5px] text-[var(--text-muted)]">{day(d.created_at)}</span>
            </div>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{d.deal_name || '—'}</p>
            <p className="mt-1 text-[12.5px] tabular-nums">
              <span className="font-semibold text-[var(--text-h)]">{rupees(d.deal_amount)}</span>
              {d.pending_amount > 0 && <span className="ml-2 text-[var(--error)]">{rupees(d.pending_amount)} pending</span>}
            </p>
          </li>
        ))}
      </Section>

      <Section
        id="money-received"
        title="Money received"
        note={`${rupees(collected)} net of refunds`}
        empty={payments.length === 0 ? `No payments received in ${monthLabel}.` : null}
      >
        {payments.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-[var(--text-h)]">{p.contact_name}</span>
              <span className={cn('shrink-0 font-semibold tabular-nums', p.amount < 0 ? 'text-[var(--error)]' : 'text-[var(--text-h)]')}>
                {p.amount < 0 ? `−${rupees(-p.amount)}` : rupees(p.amount)}
              </span>
            </div>
            <p className="truncate text-[12px] text-[var(--text-muted)]">
              {day(p.payment_date)} · {p.deal_name || 'No deal'}
              {p.kind === 'refund' ? ' · refund' : p.mop ? ` · ${p.mop}` : ''}
              {p.from_earlier_month ? ' · earlier deal' : ''}
            </p>
          </li>
        ))}
      </Section>
    </div>
  )
}
