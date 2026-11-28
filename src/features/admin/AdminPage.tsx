import { BarChart3, Bot, Filter, ListChecks, Send, Settings2, UserCog, Users, Wallet, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

// The admin areas still to be built. Each one becomes a link when its page exists.
const UPCOMING: { label: string; hint: string; icon: LucideIcon }[] = [
  { label: 'Team', hint: 'Staff, roles and permissions', icon: UserCog },
  { label: 'Team reports', hint: 'Performance, targets and salary', icon: BarChart3 },
  { label: 'Contacts & lead setup', hint: 'Import, export, bulk assign, lead status', icon: Users },
  { label: 'Sales pipeline', hint: 'Create pipelines and upload leads', icon: Filter },
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
      <ul className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 px-4 pb-10 pt-5 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
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
