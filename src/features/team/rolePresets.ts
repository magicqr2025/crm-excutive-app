// Ready-made permission sets and the rules for switching boxes. Copied from orm-whatsapp's RolePermissionsPage:
// keep the two in step, so a preset means the same in both apps.
import type { PermissionAction, RolePermission } from '@/api/teamApi'

export const ACTIONS: { action: PermissionAction; key: 'can_view' | 'can_add' | 'can_edit' | 'can_delete'; label: string }[] = [
  { action: 'view', key: 'can_view', label: 'View' },
  { action: 'add', key: 'can_add', label: 'Add' },
  { action: 'edit', key: 'can_edit', label: 'Edit' },
  { action: 'delete', key: 'can_delete', label: 'Delete' },
]

const ALL_ACTIONS: PermissionAction[] = ['view', 'add', 'edit', 'delete']

export const KEY_OF = Object.fromEntries(ACTIONS.map((a) => [a.action, a.key])) as Record<PermissionAction, (typeof ACTIONS)[number]['key']>

export const offered = (row: RolePermission): PermissionAction[] => row.actions ?? ALL_ACTIONS

/** What a preset gives a feature: the actions listed, or everything the feature offers. */
type Grant = PermissionAction[] | 'all'

const WORK: Grant = ['view', 'add', 'edit']

export const PRESETS: { name: string; hint: string; grants: (feature: string) => Grant }[] = [
  { name: 'No access', hint: 'Turns everything off', grants: () => [] },
  { name: 'Read only', hint: 'Can look, cannot change', grants: () => ['view'] },
  {
    name: 'Sales executive',
    hint: 'Works leads, deals, follow-ups, tasks and the inbox',
    grants: (f) =>
      ['leads', 'deals', 'payments', 'subscriptions', 'followups', 'meetings', 'call_logs', 'inbox', 'tickets', 'tasks', 'task_notes', 'team_chat'].includes(f)
        ? WORK
        : f === 'contact_groups'
          ? ['view', 'add']
          : ['lead_campaigns', 'products', 'templates', 'performance'].includes(f)
            ? ['view']
            : [],
  },
  {
    name: 'Support agent',
    hint: 'Inbox, tickets, tasks and call logs',
    grants: (f) =>
      ['inbox', 'tickets', 'call_logs', 'followups', 'tasks', 'task_notes', 'team_chat'].includes(f)
        ? WORK
        : ['leads', 'templates', 'contact_groups'].includes(f)
          ? ['view']
          : [],
  },
  // Workflows can message every contact, like bots and broadcasts, so this preset never switches them on.
  { name: 'Manager', hint: 'Everything except Delete, bots, workflows and custom emails', grants: (f) => (['bots', 'custom_emails', 'workflows'].includes(f) ? [] : WORK) },
  { name: 'Full access', hint: 'Everything switched on', grants: () => 'all' },
]

export function applyGrant(row: RolePermission, grant: Grant): RolePermission {
  const granted = grant === 'all' ? offered(row) : grant.filter((a) => offered(row).includes(a))
  return { ...row, can_view: granted.includes('view'), can_add: granted.includes('add'), can_edit: granted.includes('edit'), can_delete: granted.includes('delete') }
}

/** One box switched. Add, Edit and Delete are no use without seeing the thing, so switching one on switches View on too. */
export function setAction(row: RolePermission, action: PermissionAction, on: boolean): RolePermission {
  return { ...row, [KEY_OF[action]]: on, ...(on && action !== 'view' && offered(row).includes('view') ? { can_view: true } : {}) }
}

export const signature = (rows: RolePermission[]) => rows.map((r) => `${r.feature}:${+r.can_view}${+r.can_add}${+r.can_edit}${+r.can_delete}`).join('|')
