import { ArrowRight, BellRing, CalendarClock, IndianRupee, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NextStep, NextStepAction } from './leadMath'

const TONE: Record<NextStep['tone'], { bar: string; eyebrow: string; button: string }> = {
  urgent: {
    bar: 'bg-[var(--error)]',
    eyebrow: 'text-[var(--error)]',
    button: 'bg-[var(--error)] text-white hover:opacity-90',
  },
  today: {
    bar: 'bg-[var(--accent)]',
    eyebrow: 'text-[var(--accent-strong)]',
    button: 'bg-[var(--accent)] text-[var(--ink)] hover:bg-[var(--accent-strong)]',
  },
  later: {
    bar: 'bg-[var(--info)]',
    eyebrow: 'text-[var(--info)]',
    button: 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]',
  },
  idle: {
    bar: 'bg-[var(--line)]',
    eyebrow: 'text-[var(--text-muted)]',
    button: 'border border-[var(--accent-border)] text-[var(--accent-strong)] hover:bg-[var(--accent-bg)]',
  },
}

const ICON: Record<NextStepAction, typeof Phone> = {
  call: Phone,
  meeting: CalendarClock,
  payment: IndianRupee,
  followup: BellRing,
}

/**
 * The page's one loud element: what to do with this client right now. A coloured edge says how urgent it
 * is (red overdue, amber today, blue later, grey nothing planned) and the button does that one thing.
 */
export function NextStepCard({ step, onAction }: { step: NextStep; onAction: () => void }) {
  const tone = TONE[step.tone]
  const Icon = ICON[step.action]
  return (
    <section
      aria-label="Next step"
      className="relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] py-3.5 pl-5 pr-4 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:gap-4"
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5', tone.bar)} />
      <div className="min-w-0 flex-1">
        <p className={cn('font-mono-num text-[11px] uppercase tracking-[0.14em]', tone.eyebrow)}>Next step · {step.kind}</p>
        <p className="mt-0.5 font-display text-[19px] font-semibold leading-snug text-[var(--text-h)] sm:text-[21px]">{step.headline}</p>
        {step.detail && <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--text-muted)]">{step.detail}</p>}
      </div>
      <button
        type="button"
        onClick={onAction}
        className={cn('inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-colors', tone.button)}
      >
        <Icon size={16} />
        {step.actionLabel}
        <ArrowRight size={15} className="opacity-70" />
      </button>
    </section>
  )
}
