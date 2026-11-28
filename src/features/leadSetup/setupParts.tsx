import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/Spinner'
import { TeamHeader } from '@/features/team/teamParts'
import { cn } from '@/lib/utils'
import { PALETTE } from './palette'

/** A setup page: title, back to Admin, and the same loading / error states everywhere. */
export function SetupPage({
  title,
  subtitle,
  action,
  query,
  children,
}: {
  title: string
  subtitle: string
  action: ReactNode
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader title={title} subtitle={subtitle} backTo="/admin" action={action} />
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-10 pt-4 md:px-6">
        {query.isLoading ? (
          <PageLoader />
        ) : query.isError ? (
          <div className="space-y-3 py-10 text-center">
            <p role="alert" className="text-[13px] text-[var(--error)]">
              {query.error instanceof Error ? query.error.message : 'Could not load this.'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`Colour ${color}`}
          aria-pressed={value.toLowerCase() === color}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: color }}
        >
          {value.toLowerCase() === color && <Check size={16} className="text-white" />}
        </button>
      ))}
      <label className={cn('flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 text-[12px] text-[var(--text-muted)]')}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : PALETTE[0]} onChange={(e) => onChange(e.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
        Other
      </label>
    </div>
  )
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const close = () => !busy && onClose()
  return (
    <Dialog open onClose={close} variant="sheet" className="sm:max-w-sm">
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <Dialog.Body className="text-[13.5px] text-[var(--text)]">{children}</Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Please wait…' : confirmLabel}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
