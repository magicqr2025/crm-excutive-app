import { useState } from 'react'
import { Building2, Check } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

/** The owner's list of businesses. Choosing one reloads the app, so nothing of the previous business stays on screen. */
export function BusinessSwitchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const businesses = useAuthStore((s) => s.businesses)
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId)
  const switchBusiness = useAuthStore((s) => s.switchBusiness)
  const toast = useToast()
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  // Not closable half-way through a switch.
  function close() {
    if (!switchingTo) onClose()
  }

  async function choose(businessId: string) {
    if (businessId === activeBusinessId) return onClose()
    setSwitchingTo(businessId)
    try {
      await switchBusiness(businessId)
    } catch (err) {
      setSwitchingTo(null)
      toast.show({ title: err instanceof Error ? err.message : 'Could not switch business', tone: 'error' })
    }
  }

  return (
    <Dialog open={open} onClose={close} variant="sheet" className="sm:max-w-sm">
      <Dialog.Header>
        <Dialog.Title>Switch business</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <Dialog.Body className="space-y-1.5 px-3 py-3">
        {businesses.map((b) => {
          const active = b.id === activeBusinessId
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => void choose(b.id)}
              disabled={switchingTo !== null}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60',
                active ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border)] hover:bg-[var(--surface-hover)]',
              )}
            >
              <Building2 size={17} aria-hidden className={cn('shrink-0', active ? 'text-[var(--accent-strong)]' : 'text-[var(--text-muted)]')} />
              <span className="min-w-0 flex-1 break-words text-[14px] font-medium text-[var(--text-h)]">{b.name}</span>
              {switchingTo === b.id ? (
                <span className="shrink-0 text-[12px] text-[var(--text-muted)]">Switching…</span>
              ) : (
                active && <Check size={17} aria-label="Current business" className="shrink-0 text-[var(--accent-strong)]" />
              )}
            </button>
          )
        })}
      </Dialog.Body>
    </Dialog>
  )
}
