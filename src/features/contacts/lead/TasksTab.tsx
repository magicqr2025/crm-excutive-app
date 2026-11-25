import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Plus } from 'lucide-react'
import { PageLoader } from '@/components/ui/Spinner'
import { useStaffList } from '@/api/queries'
import type { CrmTask } from '@/api/crmApi'
import { TaskCard } from '@/features/tasks/TaskCard'
import { cn } from '@/lib/utils'

// Like orm-whatsapp's TaskTab: every task about this client, with Open / Completed / All, and a button that
// opens the new-task form with the client already chosen.

type Filter = 'open' | 'completed' | 'all'

const isOpen = (t: CrmTask) => t.status !== 'completed' && t.status !== 'cancelled'

export function TasksTab({ tasks, loading, userId, isAdmin, onAdd }: { tasks: CrmTask[]; loading: boolean; userId: string; isAdmin: boolean; onAdd: () => void }) {
  const navigate = useNavigate()
  const { data: staff = [] } = useStaffList()
  const [filter, setFilter] = useState<Filter>('open')
  const counts = { open: tasks.filter(isOpen).length, completed: tasks.filter((t) => t.status === 'completed').length, all: tasks.length }
  const shown = tasks
    .filter((t) => (filter === 'all' ? true : filter === 'completed' ? t.status === 'completed' : isOpen(t)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex rounded-full bg-[var(--surface-hover)] p-1">
          {(['open', 'completed', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'h-8 rounded-full px-3 text-[13px] font-medium capitalize transition-colors',
                filter === f ? 'bg-[var(--surface)] text-[var(--text-h)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
              )}
            >
              {f} <span className="font-mono-num text-[11px] text-[var(--text-muted)]">{counts[f]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--accent-strong)]"
        >
          <Plus size={15} /> Task
        </button>
      </div>
      {loading ? (
        <PageLoader />
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <ListChecks size={20} className="text-[var(--text-muted)]" />
          <p className="text-[13px] text-[var(--text-muted)]">{tasks.length === 0 ? 'No tasks for this client yet.' : `No ${filter} tasks.`}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((task) => (
            <TaskCard key={task.id} task={task} staff={staff} userId={userId} isAdmin={isAdmin} onOpen={(t) => navigate(`/tasks/${t.id}`)} />
          ))}
        </div>
      )}
    </>
  )
}
