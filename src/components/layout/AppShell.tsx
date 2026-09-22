import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Megaphone, Phone, CalendarClock, Sun, Moon, Menu, X, Handshake, CalendarCheck, Wallet, Users } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/followups', label: 'Follow-ups', icon: CalendarClock },
  { to: '/call-logs', label: 'Call Logs', icon: Phone },
  { to: '/deals', label: 'Deals', icon: Handshake },
  { to: '/meetings', label: 'Meetings', icon: CalendarCheck },
  { to: '/payments', label: 'Payments', icon: Wallet },
]

function LiveDot({ size = 6 }: { size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-full w-full rounded-full bg-[var(--success)]" />
    </span>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function AppShell() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const now = useClock()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg)] md:flex-row">
      <aside
        className="hidden shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--surface)] py-4 md:flex"
        style={{ width: 'var(--rail-width)' }}
      >
        <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)]">
          <span className="font-mono-num text-[12px] font-semibold text-[var(--accent-strong)]">EC</span>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 px-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={label} className="relative flex w-full flex-col items-center gap-1 rounded-lg py-2.5">
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-colors',
                      isActive ? 'bg-[var(--accent)]' : 'bg-transparent',
                    )}
                  />
                  <Icon size={18} className={isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-muted)]'} />
                  <span
                    className={cn(
                      'font-display text-center text-[9.5px] font-medium leading-tight',
                      isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-muted)]',
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          className="flex flex-col items-center gap-1 py-2.5 text-[var(--text-muted)] hover:text-[var(--error)]"
        >
          <LogOut size={17} />
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)] md:hidden"
            >
              <Menu size={18} />
            </button>
            <Avatar name={user?.name ?? 'Executive'} size={26} />
            <p className="truncate text-[13px] font-medium text-[var(--text-h)]">{user?.name ?? 'Executive'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden font-mono-num text-[12px] text-[var(--text-muted)] sm:inline">
              {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="flex items-center gap-1.5 font-mono-num text-[10.5px] font-semibold tracking-wide text-[var(--success)]">
              <LiveDot />
              LIVE
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {drawerOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setDrawerOpen(false)} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-3 transition-transform duration-200 ease-out md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)]">
              <span className="font-mono-num text-[11px] font-semibold text-[var(--accent-strong)]">EC</span>
            </div>
            <span className="font-display text-[14px] font-semibold text-[var(--text-h)]">Executive Console</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setDrawerOpen(false)} className="relative flex items-center gap-3 rounded-lg px-3 py-2.5">
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
                      isActive ? 'bg-[var(--accent)]' : 'bg-transparent',
                    )}
                  />
                  <Icon size={17} className={isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-muted)]'} />
                  <span
                    className={cn(
                      'text-[13.5px] font-medium',
                      isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text)]',
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--error)]"
        >
          <LogOut size={17} />
          Logout
        </button>
      </aside>
    </div>
  )
}
