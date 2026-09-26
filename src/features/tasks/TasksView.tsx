import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useToast } from '@/components/ui/useToast'
import { useCreateTask, useStaffList, useTasksPage, useUpdateTask } from '@/api/queries'
import type { CrmTask, TaskStatusFilter } from '@/api/crmApi'
import { TaskCard } from './TaskCard'
import { TaskFormDialog, type TaskFormValues } from './TaskFormDialog'
import { SELECT_CLASS } from './taskUi'

const FILTERS: { value: TaskStatusFilter | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

interface TasksViewProps {
  userId: string
  isAdmin: boolean
}

// Server-paged with infinite scroll, like the app's other lists (Meetings, Deals…).
export function TasksView({ userId, isAdmin }: TasksViewProps) {
  const [filter, setFilter] = useState<TaskStatusFilter | 'all'>('open')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [search, setSearch] = useState('')
  const { items: tasks, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useTasksPage({
    search,
    status: filter === 'all' ? undefined : filter,
    assigneeId: assigneeFilter || undefined,
  })
  const { data: staff = [] } = useStaffList()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const { show } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CrmTask | null>(null)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(task: CrmTask) {
    setEditing(task)
    setFormOpen(true)
  }

  function submit(values: TaskFormValues) {
    const done = {
      onSuccess: () => {
        show({ title: editing ? 'Task updated' : 'Task created', tone: 'success' as const })
        setFormOpen(false)
      },
      onError: (err: unknown) =>
        show({ title: err instanceof Error ? err.message : 'Could not save the task', tone: 'error' as const }),
    }
    if (editing) {
      updateTask.mutate(
        {
          id: editing.id,
          patch: {
            title: values.title,
            taskType: values.taskType,
            deadline: values.deadline,
            assignToStaffId: values.assignToStaffId,
          },
        },
        done,
      )
    } else {
      createTask.mutate(
        {
          title: values.title,
          taskType: values.taskType,
          deadline: values.deadline ?? undefined,
          assignToStaffId: values.assignToStaffId,
          contactId: values.contactId || undefined,
        },
        done,
      )
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Tasks"
        subtitle={`${total} task${total === 1 ? '' : 's'}`}
        action={
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus size={14} /> New task
          </Button>
        }
      />
      <div className="space-y-2 px-4 pt-3">
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by task or client…" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={
                  filter === f.value
                    ? 'rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)]'
                    : 'rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className={`${SELECT_CLASS} !h-9 !w-auto`}
            aria-label="Filter by assignee"
          >
            <option value="">Everyone</option>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No tasks here.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} staff={staff} userId={userId} isAdmin={isAdmin} onEdit={openEdit} />
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
      <TaskFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        staff={staff}
        userId={userId}
        task={editing}
        isSaving={createTask.isPending || updateTask.isPending}
        onSubmit={submit}
      />
    </div>
  )
}
