import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Megaphone, CalendarClock, Sun, Moon, Menu, X, Handshake, CalendarCheck, Wallet, Users, Settings, MessagesSquare, Target, Home, Bell, ShieldCheck, Building2, ChevronsUpDown } from 'lucide-react'
import { grantsAny, useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { RouteFetchBar } from '@/components/layout/RouteFetchBar'
import { PlanBanner } from '@/components/layout/PlanBanner'
import { BusinessSwitchDialog } from '@/components/layout/BusinessSwitchDialog'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/config/appVersion'
import { startDeviceCallSync } from '@/features/callLogs/deviceCallSync'
import { useUnreadNotificationCount } from '@/api/queries'
import { usePushNotifications } from '@/features/notifications/usePushNotifications'
import { LeaveToggle } from '@/features/leave/LeaveToggle'

// feature = the role-grid feature(s) an item needs (same names as orm-whatsapp's sidebar). A staff role allowed nothing
// on it (no view, add, edit or delete) doesn't see the item; admins see everything. Home and Recording are for everyone.
const NAV_ITEMS: { to: string; label: string; icon: typeof Home; feature?: string | string[]; adminOnly?: boolean }[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
  { to: '/campaigns', label: 'Pipelines', icon: Megaphone, feature: 'lead_campaigns' },
  { to: '/inbox', label: 'Inbox', icon: MessagesSquare, feature: 'inbox' },
  { to: '/contacts', label: 'Contacts', icon: Users, feature: 'leads' },
  { to: '/followups', label: 'Follow-ups', icon: CalendarClock, feature: 'followups' },
  { to: '/deals', label: 'Deals', icon: Handshake, feature: 'deals' },
  { to: '/meetings', label: 'Meetings', icon: CalendarCheck, feature: 'meetings' },
  { to: '/payments', label: 'Payments', icon: Wallet, feature: 'payments' },
  { to: '/target', label: 'Target', icon: Target, feature: ['deals', 'payments'] },
  { to: '/settings/call-recording', label: 'Recording', icon: Settings },
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
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const permissions = useAuthStore((s) => s.permissions)
  const navItems = NAV_ITEMS.filter((item) => isAdmin || (!item.adminOnly && (!item.feature || grantsAny(permissions, item.feature))))
  // The owner's business name, with a switcher when there is more than one. Staff see neither.
  const isOwner = useAuthStore((s) => s.isOwner)
  const businesses = useAuthStore((s) => s.businesses)
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId)
  const businessName = businesses.find((b) => b.id === activeBusinessId)?.name
  const canSwitch = businesses.length > 1
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const now = useClock()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  usePushNotifications()
  const { data: unreadCount = 0 } = useUnreadNotificationCount()

  useEffect(() => {
    startDeviceCallSync()
  }, [])

  // The logout buttons only ask; this runs once the executive confirms.
  // Logout waits (up to ~3s) for the push token to be unregistered, so the
  // dialog stays open with the button disabled until it's done.
  async function confirmLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
      setConfirmLogoutOpen(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg)] md:flex-row">
      <aside
        className="hidden shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--surface)] py-4 md:flex"
        style={{ width: 'var(--rail-width)' }}
      >
        <img src="/logo.png" alt="Staff Crm" className="mb-6 h-9 w-9 rounded-full" />
        {/* Scrolls on a short screen, so no item (or the logout button below) is cut off. */}
        <nav className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 [scrollbar-width:none]">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={label} className="relative flex w-full shrink-0 flex-col items-center gap-1 rounded-lg py-2.5">
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
          onClick={() => setConfirmLogoutOpen(true)}
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
            {/* Tablet and desktop; on a phone this lives in the side menu. */}
            {isOwner && businessName && (
              <button
                type="button"
                onClick={() => setSwitcherOpen(true)}
                disabled={!canSwitch}
                title={canSwitch ? 'Switch business' : businessName}
                className="hidden h-9 min-w-0 max-w-[260px] items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[12.5px] font-medium text-[var(--text-h)] enabled:hover:bg-[var(--surface-hover)] md:flex"
              >
                <Building2 size={14} aria-hidden className="shrink-0 text-[var(--accent-strong)]" />
                <span className="truncate">{businessName}</span>
                {canSwitch && <ChevronsUpDown size={13} aria-hidden className="shrink-0 text-[var(--text-muted)]" />}
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LeaveToggle />
            <span className="hidden font-mono-num text-[12px] text-[var(--text-muted)] sm:inline">
              {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="flex items-center gap-1.5 font-mono-num text-[10.5px] font-semibold tracking-wide text-[var(--success)]">
              <LiveDot />
              LIVE
            </span>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              title="Notifications"
              className="relative flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[15px] rounded-full bg-[var(--error)] px-1 text-center text-[9.5px] font-semibold leading-[15px] text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
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
        <RouteFetchBar />
        <PlanBanner />

        <main className="min-h-0 flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-h)]" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
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
            <img src="/logo.png" alt="Staff Crm" className="h-8 w-8 rounded-full" />
            <span className="font-display text-[14px] font-semibold text-[var(--text-h)]">Staff Crm</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <X size={16} />
          </button>
        </div>
        {isOwner && businessName && (
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false)
              setSwitcherOpen(true)
            }}
            disabled={!canSwitch}
            className="mt-1 flex min-h-12 items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2 text-left enabled:hover:bg-[var(--surface-hover)]"
          >
            <Building2 size={17} aria-hidden className="shrink-0 text-[var(--accent-strong)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-[var(--text-muted)]">{canSwitch ? 'Switch business' : 'Business'}</span>
              <span className="block truncate text-[13.5px] font-semibold text-[var(--text-h)]">{businessName}</span>
            </span>
            {canSwitch && <ChevronsUpDown size={15} aria-hidden className="shrink-0 text-[var(--text-muted)]" />}
          </button>
        )}
        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
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
          onClick={() => {
            // Close the side menu first so the question shows on a clean page.
            setDrawerOpen(false)
            setConfirmLogoutOpen(true)
          }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--error)]"
        >
          <LogOut size={17} />
          Logout
        </button>
        <p className="px-3 pb-1 pt-2 text-[11.5px] text-[var(--text-muted)]">Version {APP_VERSION}</p>
      </aside>

      <BusinessSwitchDialog open={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      <Dialog
        open={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        // A small centred card with space around it on a phone, not a strip touching both edges.
        className="!w-[calc(100%-2.5rem)] max-w-sm self-center sm:!w-full !h-auto rounded-[var(--radius-card)] border border-[var(--border)]"
      >
        <Dialog.Header className="border-b-0 pb-1">
          <Dialog.Title>Log out?</Dialog.Title>
          <Dialog.CloseButton onClose={() => setConfirmLogoutOpen(false)} />
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-[14px] text-[var(--text)]">You’ll need to sign in again to use the app.</p>
        </Dialog.Body>
        <Dialog.Footer className="border-t-0 pt-1">
          <Button variant="secondary" className="flex-1 justify-center sm:flex-none" onClick={() => setConfirmLogoutOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1 justify-center sm:flex-none" onClick={confirmLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out…' : 'Yes, log out'}
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  )
}
