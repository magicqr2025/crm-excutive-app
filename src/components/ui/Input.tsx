import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        data-slot="input"
        className={cn(
          'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-border)]',
          className,
        )}
        {...props}
      />
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          'w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-h)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-border)]',
          className,
        )}
        {...props}
      />
    )
  },
)

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div data-slot="field" className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--text-h)]">
        {label}
      </label>
      {children}
      {error ? (
        <span className="text-[12px] text-[var(--error)]">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-[var(--text-muted)]">{hint}</span>
      ) : null}
    </div>
  )
}
