import { PageLoader } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useStaffList, useTaskTypes, useTasksPage } from '@/api/queries'
import type { TaskStatusFilter } from '@/api/crmApi'
import { useCan, useIsAdminOrManager } from '@/store/useAuthStore'
import { TaskCard } from './TaskCard'
import { SELECT_CLASS } from './taskUi'

const FILTERS: { value: TaskStatusFilter | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'in_review', label: 'In review' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

// Server-paged with infinite scroll, like the app's other lists (Meetings, Deals…). Support tickets have their own page.
export function TasksView({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const navigate = useNavigate()
  const canAdd = useCan('tasks', 'add')
  // Only admins and managers see other people's tasks, so only they get an assignee filter.
  const seesAll = useIsAdminOrManager()
  const [filter, setFilter] = useState<TaskStatusFilter | 'all'>('open')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const { items: tasks, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useTasksPage({
    search,
    status: filter === 'all' ? undefined : filter,
    assigneeId: assigneeFilter || undefined,
    taskType: typeFilter || undefined,
    excludeTaskType: 'ticket',
  })
  const { data: staff = [] } = useStaffList()
  const { data: types = [] } = useTaskTypes()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Tasks"
        subtitle={`${total} task${total === 1 ? '' : 's'}`}
        action={
          canAdd && (
            <Button size="sm" onClick={() => navigate('/tasks/new')} className="gap-1.5">
              <Plus size={14} /> New task
            </Button>
          )
        }
      />
      <div className="space-y-2 px-4 pt-3">
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by task or client…" />
        <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border)] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                filter === f.value
                  ? 'shrink-0 whitespace-nowrap rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--ink)]'
                  : 'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className={seesAll ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={SELECT_CLASS} aria-label="Filter by project">
            <option value="">All projects</option>
            <option value="general">General</option>
            {types.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          {seesAll && (
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={SELECT_CLASS} aria-label="Filter by assignee">
            <option value="">Everyone</option>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id}
              </option>
            ))}
          </select>
          )}
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <PageLoader />
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No tasks here.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} staff={staff} userId={userId} isAdmin={isAdmin} onOpen={(t) => navigate(`/tasks/${t.id}`)} />
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
