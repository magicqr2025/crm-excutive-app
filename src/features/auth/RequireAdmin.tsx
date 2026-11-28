import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

/** Keeps admin pages to admins (the owner, or staff marked as admin). The server checks every admin request too. */
export function RequireAdmin() {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  return isAdmin ? <Outlet /> : <Navigate to="/home" replace />
}
