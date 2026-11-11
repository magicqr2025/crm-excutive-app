import { Link } from 'react-router-dom'
import { Activity, KanbanSquare, ArrowUpRight, CalendarCheck, CalendarClock, Handshake, ListChecks, MessageCircle, Phone, Repeat, Target, Ticket, Users, Wallet, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatUnreadTotal } from '@/features/teamChat/useTeamChat'

interface Tile {
  to: string
  label: string
  hint: string
  icon: LucideIcon
}

const TILES: Tile[] = [
  { to: '/target', label: 'Target', hint: 'Your month against target, pay and incentive', icon: Target },
  { to: '/payments', label: 'Payments', hint: 'Log and review money received', icon: Wallet },
  { to: '/contacts', label: 'Contacts', hint: 'Your leads and clients', icon: Users },
  { to: '/meetings', label: 'Meetings', hint: 'Scheduled, completed and rescheduled', icon: CalendarCheck },
  { to: '/followups', label: 'Follow-ups', hint: 'Calls and reminders due', icon: CalendarClock },
  { to: '/deals', label: 'Deals', hint: 'Deals you’ve closed and what’s unpaid', icon: Handshake },
  { to: '/call-logs', label: 'Call Logs', hint: 'Calls you’ve made and received', icon: Phone },
  { to: '/subscriptions', label: 'Subscriptions', hint: 'Renewals coming up for your customers', icon: Repeat },
  { to: '/tasks', label: 'Tasks', hint: 'What you need to do next', icon: ListChecks },
  { to: '/tickets', label: 'Tickets', hint: 'Issues reported and their priority', icon: Ticket },
  { to: '/lead-board', label: 'Lead Board', hint: 'Your leads by status — move them along', icon: KanbanSquare },
  { to: '/performance', label: 'My Performance', hint: 'Your calls, follow-ups and work done', icon: Activity },
  { to: '/team-chat', label: 'Team Chat', hint: 'Message your colleagues and channels', icon: MessageCircle },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function HomePage() {
  const name = useAuthStore((s) => s.user?.name)
  const first = name?.trim().split(/\s+/)[0]
  const chatUnread = useChatUnreadTotal()

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader title={first ? `${greeting()}, ${first}` : greeting()} subtitle="Pick up where you left off." />
      <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 px-4 pb-8 pt-5 sm:grid-cols-3 md:gap-4 md:px-6">
        {TILES.map(({ to, label, hint, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group relative flex min-h-[132px] flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-start justify-between">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]">
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
              <ArrowUpRight size={16} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-strong)]" />
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold text-[var(--text-h)]">{label}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">{hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
