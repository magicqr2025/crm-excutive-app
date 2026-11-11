import { useAuthStore } from '@/store/useAuthStore'
import { TasksView } from './TasksView'

export function TasksPage() {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const isAdmin = useAuthStore((s) => s.isAdmin)
  return <TasksView userId={userId} isAdmin={isAdmin} />
}
