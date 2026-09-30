import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] motion-reduce:animate-none',
        className,
      )}
      style={{ width: size, height: size }}
    />
  )
}

interface PageLoaderProps {
  label?: string
  // Fill the whole page area (route-level loads) instead of sitting inline in a section.
  fullPage?: boolean
  className?: string
}

export function PageLoader({ label = 'Loading…', fullPage = false, className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2.5 text-[13px] text-[var(--text-muted)]',
        fullPage ? 'h-full' : 'py-6',
        className,
      )}
    >
      <Spinner size={18} />
      <span>{label}</span>
    </div>
  )
}
