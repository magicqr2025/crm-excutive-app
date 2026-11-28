import { type InputHTMLAttributes, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

/** A page title with a back button. */
export function TeamHeader({ title, subtitle, backTo, action }: { title: string; subtitle?: string; backTo: string; action?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
          >
            <ArrowLeft size={17} />
          </button>
          {action}
        </div>
      }
    />
  )
}

export function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-[var(--text-h)]">{title}</h2>
        <p className="text-[12px] text-[var(--text-muted)]">{hint}</p>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

export function PasswordInput({
  show,
  onShowChange,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { show: boolean; onShowChange: (show: boolean) => void }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Input {...props} type={show ? 'text' : 'password'} autoComplete="new-password" className={cn('h-11 pr-11', className)} />
      <button
        type="button"
        onClick={() => onShowChange(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-h)]"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

/** Admin (full access) or limited by the role. */
export function AccessChoice({ isAdmin, onChange, disabled }: { isAdmin: boolean; onChange: (isAdmin: boolean) => void; disabled?: boolean }) {
  const options = [
    { value: false, title: 'Role permissions', text: 'Sees and does only what the role allows.' },
    { value: true, title: 'Admin', text: 'Full access, same as the owner. The role is ignored.' },
  ]
  return (
    <fieldset disabled={disabled} className="grid gap-2 disabled:opacity-60 sm:grid-cols-2">
      <legend className="sr-only">Access level</legend>
      {options.map((o) => (
        <label
          key={o.title}
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-3 transition-colors',
            isAdmin === o.value ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border)]',
          )}
        >
          <input type="radio" name="staff-access" checked={isAdmin === o.value} onChange={() => onChange(o.value)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[13.5px] font-medium text-[var(--text-h)]">
              {o.value && <ShieldCheck size={14} aria-hidden className="text-[var(--accent-strong)]" />}
              {o.title}
            </span>
            <span className="block text-[12px] text-[var(--text-muted)]">{o.text}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function ToggleRow({
  title,
  text,
  checked,
  onChange,
  disabled,
}: {
  title: string
  text: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-[var(--text-h)]">{title}</span>
        <span className="block text-[12px] text-[var(--text-muted)]">{text}</span>
      </span>
      <span aria-hidden className={cn('flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors', checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]')}>
        <span className={cn('h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', checked && 'translate-x-5')} />
      </span>
    </button>
  )
}

/** The bar that keeps Save in reach at the bottom of a long form. */
export function SaveBar({ note, children }: { note: ReactNode; children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-end gap-2">
        <p className="mr-auto min-w-0 text-[12.5px] text-[var(--text-muted)]" aria-live="polite">
          {note}
        </p>
        {children}
      </div>
    </div>
  )
}
