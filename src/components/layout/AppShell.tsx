import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Megaphone, Phone, CalendarClock } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/followups', label: 'Follow-ups', icon: CalendarClock },
  { to: '/call-logs', label: 'Call Logs', icon: Phone },
]

export function AppShell() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-[var(--surface)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] p-3">
        <p className="px-2 py-2 text-[13px] font-semibold text-[var(--text-h)]">{user?.name ?? 'Executive'}</p>
        <nav className="mt-2 flex-1 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium',
                  isActive ? 'bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'text-[var(--text)] hover:bg-[var(--surface-hover)]',
                )
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <LogOut size={16} /> Logout
        </button>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
