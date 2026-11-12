import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { usePopoverPosition } from '@/components/ui/usePopoverPosition'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/useToast'
import { useSetTaskStatus, useTaskTypes, useUpdateTask } from '@/api/queries'
import type { CrmTask, StaffMember } from '@/api/crmApi'
import { staffLabel } from './taskUi'

// Asks before cancelling: a cancelled task is locked, so it only happens on an explicit "Yes, cancel".
export function CancelTaskDialog({ task, onClose }: { task: CrmTask | null; onClose: () => void }) {
  const setStatus = useSetTaskStatus()
  const { show } = useToast()

  function confirm() {
    if (!task) return
    setStatus.mutate(
      { id: task.id, status: 'cancelled' },
      {
        onSuccess: () => {
          show({ title: 'Task cancelled', tone: 'success' })
          onClose()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not cancel the task', tone: 'error' }),
      },
    )
  }

  return (
    <Dialog open={task !== null} onClose={onClose} className="max-w-sm self-center !h-auto rounded-[var(--radius-card)] border border-[var(--border)]">
      <Dialog.Header>
        <Dialog.Title>Cancel task</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body>
        <p className="text-[13px] text-[var(--text)]">
          Are you sure you want to cancel <span className="font-medium text-[var(--text-h)]">{task?.title}</span>? A cancelled task is locked and can no longer be edited or moved.
        </p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          No, keep it
        </Button>
        <Button size="sm" onClick={confirm} disabled={setStatus.isPending} style={{ background: 'var(--error)' }}>
          {setStatus.isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Yes, cancel task
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}

interface ReassignMenuProps {
  task: CrmTask
  staff: StaffMember[]
  userId: string
  /** The button that opens the list; it is handed what it needs to be the menu's anchor. */
  trigger: (props: { ref: RefObject<HTMLButtonElement | null>; onClick: () => void; open: boolean; busy: boolean }) => ReactNode
}

// Hands a task to someone else at any step. Only the assignee changes. The button itself opens the list of
// people right under it; tapping a name assigns straight away.
export function ReassignMenu({ task, staff, userId, trigger }: ReassignMenuProps) {
  const { show } = useToast()
  const { data: types = [] } = useTaskTypes()
  const updateTask = useUpdateTask()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const position = usePopoverPosition(anchorRef, panelRef, open, 'start')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // A private project's tasks can only go to its members.
  const members = types.find((t) => t.name === task.task_type)?.member_ids ?? []
  const candidates = (members.length > 0 ? staff.filter((s) => members.includes(s.user_id) || s.user_id === task.assign_to_staff_id) : staff).filter(
    (s) => s.user_id !== task.assign_to_staff_id,
  )

  function assign(to: string) {
    setOpen(false)
    updateTask.mutate(
      { id: task.id, patch: { assignToStaffId: to } },
      {
        onSuccess: () => show({ title: `Assigned to ${staffLabel(staff, to)}`, tone: 'success' }),
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not reassign the task', tone: 'error' }),
      },
    )
  }

  return (
    <>
      {trigger({ ref: anchorRef, onClick: () => setOpen((v) => !v), open, busy: updateTask.isPending })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Assign to"
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              minWidth: Math.max(anchorRef.current?.offsetWidth ?? 0, 220),
              visibility: position ? 'visible' : 'hidden',
            }}
            className="z-[70] max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-md)]"
          >
            {candidates.length === 0 ? (
              <p className="px-3 py-2.5 text-[13px] text-[var(--text-muted)]">There is nobody else to give this task to.</p>
            ) : (
              candidates.map((s) => (
                <button
                  key={s.user_id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => assign(s.user_id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
                >
                  <Avatar name={staffLabel(staff, s.user_id)} size={24} />
                  <span className="min-w-0 flex-1 truncate">
                    {staffLabel(staff, s.user_id)}
                    {s.user_id === userId ? ' (me)' : ''}
                  </span>
                  {s.is_admin && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">Admin</span>}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
