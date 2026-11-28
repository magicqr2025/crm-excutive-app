import { Link } from 'react-router-dom'
import { Activity, KanbanSquare, ArrowUpRight, CalendarCheck, CalendarClock, Handshake, Inbox, ListChecks, ShieldCheck, MessageCircle, Phone, Repeat, Target, Ticket, Users, Wallet, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { grantsAny, useAuthStore } from '@/store/useAuthStore'
import { RaisedForYou } from './RaisedForYou'
import { useChatUnreadTotal } from '@/features/teamChat/useTeamChat'
import { useMyActivity, useOpenTaskCount, useRenewalsDueCount, useTicketSummary, useTodayFollowupCount, useTodayMeetingCount } from '@/api/queries'
import { toDay } from '@/features/performance/performanceUtils'
import { useConversations } from '@/features/inbox/useInbox'
import { KIND_COLOR } from '@/features/contacts/lead/leadConstants'

interface Tile {
  to: string
  label: string
  hint: string
  icon: LucideIcon
  /** The tile's own colour; follow-up, meeting, task, call, deal and payment reuse the lead page's colours. */
  color: string
  /** Role-grid feature(s) it needs (same names as orm-whatsapp's dashboard); admins always see it. */
  feature: string | string[]
}

// Grouped by what the work is, so the page reads as three short lists instead of one long grid.
const SECTIONS: { title: string; tiles: Tile[] }[] = [
  {
    title: 'Your work',
    tiles: [
      { to: '/contacts', label: 'Contacts', hint: 'Your leads and clients', icon: Users, color: '#db2777', feature: 'leads' },
      { to: '/followups', label: 'Follow-ups', hint: 'Calls and reminders due', icon: CalendarClock, color: KIND_COLOR.followup, feature: 'followups' },
      { to: '/meetings', label: 'Meetings', hint: 'Scheduled, completed and rescheduled', icon: CalendarCheck, color: KIND_COLOR.meeting, feature: 'meetings' },
      { to: '/tasks', label: 'Tasks', hint: 'What you need to do next', icon: ListChecks, color: KIND_COLOR.task, feature: 'tasks' },
      { to: '/call-logs', label: 'Call Logs', hint: 'Calls you’ve made and received', icon: Phone, color: KIND_COLOR.call, feature: 'call_logs' },
      { to: '/lead-board', label: 'Lead Board', hint: 'Your leads by status — move them along', icon: KanbanSquare, color: '#4f46e5', feature: 'leads' },
    ],
  },
  {
    title: 'Money',
    tiles: [
      { to: '/payments', label: 'Payments', hint: 'Log and review money received', icon: Wallet, color: KIND_COLOR.payment, feature: 'payments' },
      { to: '/deals', label: 'Deals', hint: 'Deals you’ve closed and what’s unpaid', icon: Handshake, color: KIND_COLOR.deal, feature: 'deals' },
      { to: '/subscriptions', label: 'Subscriptions', hint: 'Renewals coming up for your customers', icon: Repeat, color: KIND_COLOR.paylink, feature: 'subscriptions' },
      { to: '/target', label: 'Target', hint: 'Your month against target, pay and incentive', icon: Target, color: '#ea580c', feature: ['deals', 'payments'] },
    ],
  },
  {
    title: 'Team & you',
    tiles: [
      { to: '/tickets', label: 'Tickets', hint: 'Issues reported and their priority', icon: Ticket, color: '#dc2626', feature: 'tickets' },
      { to: '/team-chat', label: 'Team Chat', hint: 'Message your colleagues and channels', icon: MessageCircle, color: '#9333ea', feature: 'team_chat' },
      { to: '/performance', label: 'My Performance', hint: 'Your calls, follow-ups and work done', icon: Activity, color: '#c97a1a', feature: 'performance' },
    ],
  },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

export function HomePage() {
  const name = useAuthStore((s) => s.user?.name)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const permissions = useAuthStore((s) => s.permissions)
  const canAccess = (feature: string | string[]) => isAdmin || grantsAny(permissions, feature)
  const first = name?.trim().split(/\s+/)[0]
  const chatUnread = useChatUnreadTotal()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: followupsToday } = useTodayFollowupCount(userId)
  const { data: meetingsToday } = useTodayMeetingCount()
  // Today's own activity (IST day): new leads, payments, deals, calls.
  const today = toDay(new Date())
  const { data: activity } = useMyActivity({ from: today, to: today })
  const mine = activity ? (activity.staff.find((s) => s.staff_id === userId) ?? (activity.staff.length <= 1 ? activity.totals : undefined)) : undefined
  const { data: renewalsDue } = useRenewalsDueCount()
  const { data: openTasks } = useOpenTaskCount()
  const { data: ticketSummary } = useTicketSummary()
  // WhatsApp chats with messages you haven't read yet (same polled list the Inbox uses).
  const { data: conversations } = useConversations()
  const unreadChats = conversations?.filter((c) => (c.unreadCount ?? 0) > 0).length

  // "Today" strip: the four numbers that decide the day. Their tiles below then just show an arrow, so no count is shown twice.
  const allTodayStats: { to: string; label: string; n: number | undefined; icon: LucideIcon; color: string; feature: string }[] = [
    { to: '/contacts', label: 'New contacts', n: mine?.leads, icon: Users, color: '#db2777', feature: 'leads' },
    { to: '/followups', label: 'Follow-ups due', n: followupsToday, icon: CalendarClock, color: KIND_COLOR.followup, feature: 'followups' },
    { to: '/meetings', label: 'Meetings', n: meetingsToday, icon: CalendarCheck, color: KIND_COLOR.meeting, feature: 'meetings' },
    { to: '/inbox', label: 'Unread chats', n: unreadChats, icon: Inbox, color: '#16a34a', feature: 'inbox' },
    { to: '/tasks', label: 'Open tasks', n: openTasks, icon: ListChecks, color: KIND_COLOR.task, feature: 'tasks' },
    { to: '/call-logs', label: 'Calls made', n: mine?.calls.total, icon: Phone, color: KIND_COLOR.call, feature: 'call_logs' },
  ]
  // Only what the role may use, like orm-whatsapp's dashboard (admins see everything).
  const todayStats = allTodayStats.filter((t) => canAccess(t.feature))
  const sections = SECTIONS.map((sec) => ({ ...sec, tiles: sec.tiles.filter((t) => canAccess(t.feature)) })).filter((sec) => sec.tiles.length > 0)
  const inStrip = new Set(todayStats.map((s) => s.to))
  const tileCount: Record<string, { n: number | undefined; suffix: string }> = {
    '/contacts': { n: mine?.leads, suffix: 'new today' },
    '/payments': { n: mine?.payments.count, suffix: 'today' },
    '/deals': { n: mine?.deals, suffix: 'today' },
    '/subscriptions': { n: renewalsDue, suffix: 'due' },
    '/tickets': { n: ticketSummary?.active, suffix: 'open' },
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader title={first ? `${greeting()}, ${first}` : greeting()} subtitle="Pick up where you left off." />
      <div className="mx-auto w-full max-w-4xl px-4 pt-5 empty:hidden md:px-6">
        <RaisedForYou />
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 pb-10 pt-5 md:px-6">
        {isAdmin && (
          <Link
            to="/admin"
            className="group flex items-center gap-3 rounded-2xl bg-[var(--accent-bg)] p-3.5 ring-1 ring-[var(--accent-border)] transition-[filter] hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent-strong)]">
              <ShieldCheck size={20} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold leading-tight text-[var(--text-h)]">Admin</span>
              <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">Manage your team and business</span>
            </span>
            <ArrowUpRight size={16} aria-hidden className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-h)]" />
          </Link>
        )}

        {/* Today */}
        <section aria-labelledby="home-today" className="flex flex-col gap-3">
          <h2 id="home-today" className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Today
          </h2>
          {/* Six boxes: 2 × 3 on a phone, 3 × 2 on a tablet, one row on a wide screen. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {todayStats.map(({ to, label, n, icon: Icon, color }) => (
              <Link
                key={to}
                to={to}
                className={`group flex flex-col gap-3 rounded-2xl p-4 ring-1 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
                style={{ background: tint(color, 9), ['--tw-ring-color' as string]: tint(color, 22) }}
              >
                <span className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface)] shadow-[var(--shadow-sm)]" style={{ color }}>
                    <Icon size={17} />
                  </span>
                  <ArrowUpRight size={15} className="text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span>
                  <span className="block font-mono-num text-[28px] font-semibold leading-none tracking-[-0.02em]" style={{ color: `color-mix(in srgb, ${color} 80%, var(--text-h))` }}>
                    {n ?? '–'}
                  </span>
                  <span className="mt-1.5 block text-[12.5px] font-medium text-[var(--text-h)]">{label}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.title} aria-label={section.title} className="flex flex-col gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{section.title}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.tiles.map(({ to, label, hint, icon: Icon, color }) => {
                const count = inStrip.has(to) ? undefined : tileCount[to]
                return (
                  <Link
                    key={to}
                    to={to}
                    className="group flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[var(--border)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: tint(color, 13), color }}>
                      <Icon size={20} />
                      {to === '/team-chat' && chatUnread > 0 && (
                        <span
                          aria-label={`${chatUnread} unread`}
                          className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[var(--error)] px-1.5 text-center text-[11px] font-semibold leading-5 text-white"
                        >
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold leading-tight text-[var(--text-h)]">{label}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">{hint}</span>
                    </span>
                    {count?.n !== undefined && count.n > 0 ? (
                      <span className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: tint(color, 13), color: `color-mix(in srgb, ${color} 80%, var(--text-h))` }}>
                        <span className="font-mono-num">{count.n}</span> {count.suffix}
                      </span>
                    ) : (
                      <ArrowUpRight size={16} className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-h)]" />
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
