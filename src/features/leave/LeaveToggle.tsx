import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { staffMe } from '@/lib/staffAuthClient'
import { setMyLeaveStatus } from '@/api/crmApi'
import { useAuthStore } from '@/store/useAuthStore'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

/**
 * Header switch for "On leave". While on, the executive gets no new leads (automatic distribution
 * and Start Calling skip them); leads they already have stay with them. It never turns off by
 * itself, so the header keeps showing it until they (or an admin) switch it off.
 */
export function LeaveToggle() {
  const user = useAuthStore((s) => s.user)
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId)
  const queryClient = useQueryClient()
  const { show } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { data: onLeave, isSuccess } = useQuery({
    queryKey: ['my-leave-status', activeBusinessId, user?.id ?? null],
    queryFn: async () => (await staffMe()).on_leave === true,
    enabled: !!user && !!activeBusinessId,
    staleTime: 60_000,
  })
  const setLeave = useMutation({
    mutationFn: setMyLeaveStatus,
    onSuccess: (res) => {
      queryClient.setQueryData(['my-leave-status', activeBusinessId, user?.id ?? null], res.on_leave)
      setConfirmOpen(false)
      show({
        title: res.on_leave ? "You are not working — you won't get new leads" : 'You are working — new leads will come to you again',
        tone: 'success',
      })
    },
    onError: (err) => show({ title: err instanceof Error ? err.message : 'Something went wrong', tone: 'error' }),
  })

  if (!isSuccess) return null
  return (
    <>
    <button
      type="button"
      role="switch"
      aria-checked={!onLeave}
      disabled={setLeave.isPending}
      onClick={() => (onLeave ? setLeave.mutate(false) : setConfirmOpen(true))}
      title={onLeave ? 'You are not working and not getting new leads. Tap to switch to Working.' : 'Switch off when you are on leave: you will get no new leads.'}
      className={cn(
        'flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11.5px] font-medium transition-colors disabled:opacity-60',
        onLeave
          ? 'border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]'
          : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
      )}
    >
      <Briefcase size={13} />
      {onLeave ? 'Not working' : <span className="max-sm:hidden">Working</span>}
      <span
        aria-hidden
        className={cn('relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors', onLeave ? 'bg-[var(--border)]' : 'bg-[var(--success)]')}
      >
        <span className={cn('inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform', onLeave ? 'translate-x-0.5' : 'translate-x-3')} />
      </span>
    </button>

    <Dialog
      open={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      className="max-w-xs self-center !h-auto rounded-[var(--radius-card)] border border-[var(--border)]"
    >
      <div className="flex flex-col items-center px-6 pb-5 pt-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]">
          <Briefcase size={22} />
        </span>
        <p className="mt-3 text-[16px] font-semibold text-[var(--text-h)]">Switch to Not working?</p>
        <p className="mt-1.5 text-[13px] text-[var(--error)]">Remember to switch back to Working when you are back.</p>
        <div className="mt-5 grid w-full grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setLeave.mutate(true)} disabled={setLeave.isPending}>
            {setLeave.isPending ? 'Saving…' : 'Yes'}
          </Button>
        </div>
      </div>
    </Dialog>
    </>
  )
}
