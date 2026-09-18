import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'accent' | 'ai' | 'info' | 'success' | 'warning' | 'error'
type Size = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: Size
}

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-hover)] text-[var(--text)] border-[var(--border)]',
  accent: 'bg-[var(--accent-bg)] text-[var(--accent-strong)] border-[var(--accent-border)]',
  ai: 'bg-[var(--accent-ai-bg)] text-[var(--accent-ai-strong)] border-[var(--accent-ai-border)]',
  info: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
  error: 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error-border)]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-[13px]',
}

export function Badge({ tone = 'neutral', size = 'sm', className, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn('inline-flex items-center gap-1 rounded-full border font-medium leading-none', sizeClasses[size], toneClasses[tone], className)}
      {...props}
    />
  )
}
