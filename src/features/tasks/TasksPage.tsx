import { useAuthStore } from '@/store/useAuthStore'
import { TasksView } from './TasksView'

export function TasksPage() {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  // Executives are never admins in this app; the server enforces the real rules.
  return <TasksView userId={userId} isAdmin={false} />
}
