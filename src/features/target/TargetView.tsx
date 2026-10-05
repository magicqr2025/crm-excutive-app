import { useEffect, useState } from 'react'
import type { CrmStaffTarget } from '@/api/crmApi'

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const monthName = (m: number, y: number) => `${new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: 'long' })} ${y}`

function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return mounted
}

function daysLeftIn(month: number, year: number): number | null {
  const now = new Date()
  if (now.getMonth() + 1 !== month || now.getFullYear() !== year) return null
  return new Date(year, month, 0).getDate() - now.getDate() + 1
}

/** Incentive (only once the target is reached) is the slab rate applied to the part of the collected amount that falls inside each slab. */
function incentiveFor(target: CrmStaffTarget): number {
  // Nothing is paid until the collected amount reaches the target.
  if (!(target.target_amount > 0 && target.achieved_amount >= target.target_amount)) return 0
  const total = (target.incentive_slab ?? []).reduce((sum, slab) => {
    const inSlab = Math.max(0, Math.min(slab.to, target.achieved_amount) - Math.max(slab.from, 0))
    return sum + (inSlab * slab.rate) / 100
  }, 0)
  return Math.round(total)
}

interface Props {
  target: CrmStaffTarget
  month: number
  year: number
  monthLabel: string
  name: string
}

/** The executive's month as one dial: where they stand against target, what it pays, and the next slab to climb. */
export function TargetView({ target, month, year, monthLabel, name }: Props) {
  const slabs = [...(target.incentive_slab ?? [])].sort((a, b) => a.from - b.from)
  const achieved = target.achieved_amount
  const incentive = incentiveFor(target)
  const finalSalary = Math.round(target.base_salary + incentive)
  const due = Math.max(0, target.target_amount - achieved)
  const pct = target.target_amount > 0 ? (achieved / target.target_amount) * 100 : 0
  const reached = target.target_amount > 0 && due === 0
  const over = Math.max(0, achieved - target.target_amount)
  const daysLeft = daysLeftIn(month, year)
  const perDay = daysLeft && due > 0 ? due / daysLeft : null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {target.carried_forward && target.carried_from_month && target.carried_from_year && (
        <p className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] px-4 py-2.5 text-[12.5px] text-[var(--accent-strong)]">
          Your target from {monthName(target.carried_from_month, target.carried_from_year)} continues into {monthLabel} until your admin changes it.
        </p>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-[#17140f] p-5 text-white shadow-[0_20px_50px_-24px_rgba(23,20,15,0.9)] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(244,169,59,0.3),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(53,208,140,0.14),transparent_65%)]" />

        <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,300px)_1fr] md:gap-8">
          <Dial pct={pct} reached={reached} slabs={slabs} target={target.target_amount} />

          <div className="min-w-0">
            <p className="font-display text-[12px] font-medium uppercase tracking-[0.14em] text-amber-200/80">
              {name} · {monthLabel}
            </p>
            <p className="font-mono-num mt-2 text-[44px] font-semibold leading-none tracking-tight sm:text-[56px]">{inr(achieved)}</p>
            <p className="mt-2 text-[14px] text-stone-300">
              collected against a target of <span className="font-semibold text-white">{inr(target.target_amount)}</span>
            </p>

            <p
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                reached ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30' : 'bg-amber-300/15 text-amber-200 ring-1 ring-amber-200/30'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${reached ? 'bg-emerald-300' : 'bg-amber-200'}`} />
              {reached ? (over > 0 ? `Target reached — ${inr(over)} over` : 'Target reached') : `${inr(due)} to go`}
            </p>

            <dl className="mt-6 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-4">
              <HeroFact label="Days left" value={daysLeft !== null ? String(daysLeft) : '—'} />
              <HeroFact label="Needed per day" value={perDay !== null ? inr(perDay) : reached ? 'Done' : '—'} />
              <HeroFact label="Still to collect on deals" value={inr(target.pending_amount)} />
            </dl>
          </div>
        </div>

        {target.collected_from_earlier_months > 0 && (
          <p className="relative mt-5 text-[12px] text-stone-400">Includes {inr(target.collected_from_earlier_months)} received this month on deals closed earlier.</p>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">This month’s pay</p>
        <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1.25fr]">
          <PayPart label="Base salary" value={inr(target.base_salary)} />
          <Operator>+</Operator>
          <PayPart label="Incentive" value={inr(incentive)} accent />
          <Operator>=</Operator>
          <div className="rounded-2xl bg-[linear-gradient(135deg,var(--accent),#c97a1a)] px-5 py-4 text-[var(--ink)] shadow-[0_12px_30px_-14px_var(--accent)]">
            <p className="text-[12px] opacity-75">Final salary</p>
            <p className="font-mono-num mt-0.5 text-[28px] font-semibold leading-tight">{inr(finalSalary)}</p>
          </div>
        </div>
      </section>

      {slabs.length > 0 && <SlabStairs slabs={slabs} target={target} incentive={incentive} />}
    </div>
  )
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0">
      <dt className="text-[11px] leading-tight text-stone-400">{label}</dt>
      <dd className="font-mono-num mt-1 text-[17px] font-semibold text-white">{value}</dd>
    </div>
  )
}

function PayPart({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] px-5 py-4">
      <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
      <p className={`font-mono-num mt-0.5 text-[24px] font-semibold ${accent ? 'text-[var(--accent-strong)]' : 'text-[var(--text-h)]'}`}>{value}</p>
    </div>
  )
}

function Operator({ children }: { children: string }) {
  return <span className="text-center text-[22px] font-light text-[var(--text-muted)]">{children}</span>
}

/** Half-circle dial: 10% ticks, slab thresholds as notches, progress arc and a knob at the current position. */
function Dial({ pct, reached, slabs, target }: { pct: number; reached: boolean; slabs: CrmStaffTarget['incentive_slab'] & object; target: number }) {
  const mounted = useMounted()
  const cx = 150
  const cy = 150
  const r = 118
  const shown = mounted ? Math.min(pct, 100) : 0
  const point = (p: number, radius: number) => {
    const a = (p / 100) * Math.PI
    return { x: cx - radius * Math.cos(a), y: cy - radius * Math.sin(a) }
  }
  const knob = point(shown, r)
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const notches = slabs.map((s) => (target > 0 ? (s.from / target) * 100 : 0)).filter((p) => p > 0 && p < 100)

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <svg viewBox="0 0 300 175" className="w-full overflow-visible" role="img" aria-label={`${Math.round(pct)}% of target collected`}>
        <defs>
          <linearGradient id="dial-progress" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor={reached ? '#34d399' : '#f59e0b'} />
          </linearGradient>
        </defs>

        {Array.from({ length: 11 }, (_, i) => {
          const a = point(i * 10, r + 14)
          const b = point(i * 10, r + (i % 5 === 0 ? 24 : 20))
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.28)" strokeWidth={i % 5 === 0 ? 2 : 1} strokeLinecap="round" />
        })}

        <path d={arc} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={16} strokeLinecap="round" />
        <path
          d={arc}
          pathLength={100}
          fill="none"
          stroke="url(#dial-progress)"
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${shown} 100`}
          className="transition-[stroke-dasharray] duration-[1100ms] ease-out motion-reduce:transition-none"
        />

        {notches.map((p) => {
          const a = point(p, r - 14)
          const b = point(p, r + 14)
          return <line key={p} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeDasharray="2 3" />
        })}

        <circle cx={knob.x} cy={knob.y} r={11} fill="#17140f" stroke="white" strokeWidth={3} className="transition-all duration-[1100ms] ease-out motion-reduce:transition-none" />

        <text x={cx - r} y={cy + 24} textAnchor="middle" className="fill-stone-400 text-[11px]">0</text>
        <text x={cx + r} y={cy + 24} textAnchor="middle" className="fill-stone-400 text-[11px]">Target</text>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center">
        <span className="font-mono-num text-[44px] font-semibold leading-none">
          {Math.round(pct)}
          <span className="text-[22px] text-stone-300">%</span>
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">of target</span>
      </div>
    </div>
  )
}

/** Each slab is a step taller than the last; the fill shows how much of that step has been climbed. */
function SlabStairs({ slabs, target, incentive }: { slabs: NonNullable<CrmStaffTarget['incentive_slab']>; target: CrmStaffTarget; incentive: number }) {
  const mounted = useMounted()
  const achieved = target.achieved_amount
  const maxRate = Math.max(...slabs.map((s) => s.rate), 1)
  const next = slabs.find((s) => achieved < s.from)
  const openEnded = (to: number) => to >= target.target_amount * 10

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Incentive slabs</p>
          <h2 className="font-display mt-1 text-[18px] font-semibold text-[var(--text-h)]">
            {next ? `${inr(next.from - achieved)} more unlocks ${next.rate}%` : 'You’re earning at the top rate'}
          </h2>
        </div>
        <p className="text-[12.5px] text-[var(--text-muted)]">
          Earned so far: <span className="font-semibold text-[var(--text-h)]">{inr(incentive)}</span>
        </p>
      </div>

      <div className="mt-6 flex items-end gap-2 sm:gap-3">
        {slabs.map((s, i) => {
          const span = openEnded(s.to) ? Math.max(target.target_amount * 0.5, 1) : Math.max(s.to - s.from, 1)
          const climbed = Math.min(1, Math.max(0, (achieved - s.from) / span))
          const state = climbed >= 1 ? 'done' : climbed > 0 ? 'active' : 'locked'
          const earned = (Math.max(0, Math.min(s.to, achieved) - s.from) * s.rate) / 100
          const height = 96 + (s.rate / maxRate) * 96
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col">
              <div className="mb-2 flex items-baseline justify-between gap-1">
                <span className="font-mono-num text-[20px] font-semibold text-[var(--text-h)]">{s.rate}%</span>
                <span className={`text-[11px] font-medium ${state === 'locked' ? 'text-[var(--text-muted)]' : 'text-[var(--accent-strong)]'}`}>
                  {state === 'done' ? 'Cleared' : state === 'active' ? 'In progress' : 'Locked'}
                </span>
              </div>
              <div
                className={`relative overflow-hidden rounded-2xl border ${state === 'active' ? 'border-[var(--accent-border)]' : 'border-[var(--border)]'} bg-[var(--surface-hover)]`}
                style={{ height }}
              >
                <div
                  className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,#fbbf24,var(--accent))] transition-[height] duration-[900ms] ease-out motion-reduce:transition-none"
                  style={{ height: mounted ? `${climbed * 100}%` : '0%', opacity: state === 'locked' ? 0 : 1 }}
                />
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className={`font-mono-num text-[12px] font-semibold ${climbed > 0.35 ? 'text-[var(--ink)]' : 'text-[var(--text-h)]'}`}>
                    {state === 'locked' ? '—' : inr(earned)}
                  </p>
                </div>
              </div>
              <p className="font-mono-num mt-2 truncate text-[11.5px] text-[var(--text-muted)]" title={`${inr(s.from)} – ${openEnded(s.to) ? 'and above' : inr(s.to)}`}>
                {inr(s.from)} {openEnded(s.to) ? '+' : `– ${inr(s.to)}`}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
