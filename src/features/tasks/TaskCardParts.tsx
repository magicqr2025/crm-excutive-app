import type { ReactNode, RefObject } from 'react'
import { cn } from '@/lib/utils'

// Pieces shared by the task page and the task form, so both read as the same card.

export type ActionTone = 'primary' | 'neutral' | 'danger'

const ACTION_TONE: Record<ActionTone, string> = {
  primary: 'bg-[var(--accent)] text-[var(--ink)] shadow-[var(--shadow-sm)] hover:brightness-95',
  neutral: 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]',
  danger: 'border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error)] hover:brightness-95',
}

// A full-size, thumb-friendly button for the card's footer.
export function ActionButton({ tone = 'neutral', icon, children, wide, disabled, onClick, buttonRef, trailing }: { tone?: ActionTone; icon: ReactNode; children: ReactNode; wide?: boolean; disabled?: boolean; onClick: () => void; buttonRef?: RefObject<HTMLButtonElement | null>; trailing?: ReactNode }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-[13.5px] font-semibold transition disabled:opacity-50',
        ACTION_TONE[tone],
        wide && 'col-span-2',
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {trailing}
    </button>
  )
}


// One of the three key facts (assignee, due date, project) in the card's summary strip.
export function FactCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      {children}
    </div>
  )
}
