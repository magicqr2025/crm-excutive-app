import { Link } from 'react-router-dom'
import { BarChart3, Bot, ChevronRight, CircleDot, Filter, Flag, LayoutDashboard, ListChecks, Send, Settings2, ShieldCheck, Tag, TrendingUp, UserCog, Users, Wallet, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

// Pages that are built.
const READY: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: '/admin/overview', label: 'Business Overview', hint: 'Today’s work, targets and growth', icon: LayoutDashboard },
  { to: '/admin/performance', label: 'Team Performance', hint: 'Activity, targets and salary', icon: BarChart3 },
  { to: '/admin/staff', label: 'Staff', hint: 'Logins, access and new leads', icon: UserCog },
  { to: '/campaigns', label: 'Sales Pipelines', hint: 'Create, edit and choose who gets leads', icon: Filter },
  { to: '/campaigns/performance', label: 'Campaign Performance', hint: 'Compare your pipelines', icon: TrendingUp },
  { to: '/admin/roles', label: 'Roles & Permissions', hint: 'What each role can see and do', icon: ShieldCheck },
  { to: '/admin/lead-status', label: 'Lead Status', hint: 'Statuses for each stage', icon: CircleDot },
  { to: '/admin/flags', label: 'Flags', hint: 'Call flags on leads', icon: Flag },
  { to: '/admin/labels', label: 'Labels', hint: 'Tags on contacts', icon: Tag },
  { to: '/admin/groups', label: 'Contact Groups', hint: 'Lists of contacts', icon: Users },
]

// The admin areas still to be built. Each one moves up to READY when its page exists.
const UPCOMING: { label: string; hint: string; icon: LucideIcon }[] = [
  { label: 'Sales dashboard', hint: 'Key numbers, charts and what needs attention', icon: BarChart3 },
  { label: 'Money', hint: 'Payment corrections, payment links, products', icon: Wallet },
  { label: 'Daily work tools', hint: 'Projects, booking setup, ticket masters, chat channels', icon: ListChecks },
  { label: 'Marketing', hint: 'Broadcasts, templates and sequences', icon: Send },
  { label: 'Settings & account', hint: 'WhatsApp, integrations, businesses and plans', icon: Settings2 },
  { label: 'Advanced', hint: 'AI calls, AI agents and workflows', icon: Bot },
]

export function AdminPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader title="Admin" subtitle="Manage your team and business." />
      <ul className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 px-4 pt-5 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {READY.map(({ to, label, hint, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex h-full items-center gap-3 rounded-2xl bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] ring-1 ring-[var(--accent-border)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold leading-tight text-[var(--text-h)]">{label}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-muted)]">{hint}</span>
              </span>
              <ChevronRight size={17} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 px-4 pb-10 pt-3 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {UPCOMING.map(({ label, hint, icon: Icon }) => (
          <li key={label} className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent-strong)]">
              <Icon size={20} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold leading-tight text-[var(--text-h)]">{label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-muted)]">{hint}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
              Coming soon
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
