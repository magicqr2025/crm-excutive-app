import { cn } from '@/lib/utils'

export const chipClass = (active: boolean) =>
  cn(
    'h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
    active
      ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
  )
