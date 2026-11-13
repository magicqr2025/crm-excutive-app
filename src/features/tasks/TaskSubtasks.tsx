import { useState } from 'react'
import { Check, ListChecks, Plus, X } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { useTaskSubtaskMutations } from '@/api/queries'
import type { CrmTask } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { canChangeSubtasks, subtaskProgress } from './taskUi'

/** "2/5 subtasks" with a thin bar, for cards; nothing when the task has no checklist. */
export function SubtaskProgressLine({ task, className }: { task: CrmTask; className?: string }) {
  const { done, total, percent } = subtaskProgress(task)
  if (total === 0) return null
  return (
    <p className={cn('flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]', className)} title={`${done} of ${total} subtasks done`}>
      <ListChecks size={12} className="shrink-0" />
      <span className="tabular-nums">
        {done}/{total} subtasks
      </span>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-[var(--surface-hover)]" aria-hidden="true">
        <span className="block h-full rounded-full bg-[var(--success)]" style={{ width: `${percent}%` }} />
      </span>
    </p>
  )
}

// The task's checklist: whoever is on the task (creator, assignee, admin) adds items, ticks them off and
// removes them; each change is saved straight away. Anyone who can see the task sees the progress.
export function TaskSubtasks({ task, userId, isAdmin }: { task: CrmTask; userId: string; isAdmin: boolean }) {
  const { add, update, remove } = useTaskSubtaskMutations(task.id)
  const { show } = useToast()
  const [draft, setDraft] = useState('')
  const items = task.subtasks ?? []
  const canWrite = canChangeSubtasks(task, userId, isAdmin)
  const { done, total, percent } = subtaskProgress(task)
  const busy = add.isPending || update.isPending || remove.isPending
  const onError = (err: unknown) => show({ title: err instanceof Error ? err.message : 'Could not update the subtasks', tone: 'error' })

  // Nothing to show to someone who can't add to it.
  if (items.length === 0 && !canWrite) return null

  function submit() {
    const title = draft.trim()
    if (!title) return
    add.mutate(title, { onSuccess: () => setDraft(''), onError })
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-h)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <ListChecks size={15} />
          </span>
          Subtasks
        </h3>
        {total > 0 && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums',
              done === total ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]',
            )}
          >
            {done} of {total} done
          </span>
        )}
      </header>
      <div className="space-y-3 px-4 pb-4 pt-3 sm:px-5">
        {total > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]" role="progressbar" aria-label="Subtasks done" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[var(--success)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {items.map((sub) => (
              <li key={sub.id} className="group flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={sub.done}
                  aria-label={sub.done ? `Mark “${sub.title}” as not done` : `Mark “${sub.title}” as done`}
                  disabled={!canWrite || busy}
                  onClick={() => update.mutate({ subtaskId: sub.id, done: !sub.done }, { onError })}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-default',
                    sub.done ? 'border-[var(--success)] bg-[var(--success)] text-white' : 'border-[var(--border)] hover:border-[var(--accent)]',
                  )}
                >
                  {sub.done && <Check size={13} strokeWidth={3} />}
                </button>
                <span className={cn('min-w-0 flex-1 break-words text-[14px] leading-snug', sub.done ? 'text-[var(--text-muted)] line-through' : 'font-medium text-[var(--text-h)]')}>{sub.title}</span>
                {canWrite && (
                  <button
                    type="button"
                    aria-label={`Remove “${sub.title}”`}
                    disabled={busy}
                    onClick={() => remove.mutate(sub.id, { onError })}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--error-bg)] hover:text-[var(--error)] disabled:opacity-50"
                  >
                    <X size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] py-1.5 pl-3 pr-1.5 transition-colors focus-within:border-[var(--accent-border)] focus-within:bg-[var(--surface)]">
            <Plus size={16} className="shrink-0 text-[var(--text-muted)]" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              maxLength={300}
              placeholder="Add a subtask"
              aria-label="Add a subtask"
              disabled={add.isPending}
              className="h-8 min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text-h)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || add.isPending}
              className="h-8 shrink-0 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-[var(--ink)] transition hover:brightness-95 disabled:bg-transparent disabled:text-[var(--text-muted)] disabled:opacity-60"
            >
              {add.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
