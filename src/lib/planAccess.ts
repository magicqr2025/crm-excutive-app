// What crmbackend reports about the plan behind a session. A plan that has ended, is missing or doesn't include
// the CRM still lets people sign in and read; the server refuses every change. A single feature can also be
// switched off, which makes only its pages view-only. Same rules as orm-whatsapp (lib/featureLocks.ts).

export interface PlanAccess {
  limited: boolean
  reason: 'expired' | 'no_crm' | 'no_plan' | null
  /** Features the plan switches off, e.g. "taskManager". */
  locked_features?: string[]
}

const LIMITED_TITLES = {
  expired: 'Your plan has expired',
  no_plan: 'There is no active plan',
  no_crm: "CRM isn't part of this plan",
}

const FEATURE_PAGES: { key: string; label: string; path: string }[] = [
  { key: 'taskManager', label: 'Task Manager', path: '/tasks' },
  { key: 'meetingScheduler', label: 'Meeting Scheduler', path: '/meetings' },
  { key: 'ticketManagement', label: 'Ticket Management', path: '/tickets' },
  { key: 'whatsappApi', label: 'WhatsApp API', path: '/inbox' },
]

/** The view-only notice for this page, or null when nothing is limited here. */
export function planNotice(access: PlanAccess | null, pathname: string): string | null {
  if (!access) return null
  if (access.limited) return LIMITED_TITLES[access.reason ?? 'no_crm']
  const feature = FEATURE_PAGES.find((f) => pathname === f.path || pathname.startsWith(`${f.path}/`))
  if (!feature || !access.locked_features?.includes(feature.key)) return null
  return `${feature.label} isn't part of this plan`
}
