import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  radius?: string
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]',
  secondary: 'bg-[var(--surface)] text-[var(--text-h)] border border-[var(--border)] hover:bg-[var(--surface-hover)]',
  ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--surface-hover)]',
  outline: 'bg-transparent text-[var(--accent)] border border-[var(--accent-border)] hover:bg-[var(--accent-bg)]',
  danger: 'bg-[var(--error)] text-white hover:opacity-90',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-10 w-10 justify-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', radius = 'rounded-lg', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-slot="button"
      className={cn(
        'inline-flex items-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        radius,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
})
