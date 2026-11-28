import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'
import type { PermissionAction, RolePermission, TeamRole } from '@/api/teamApi'
import { ACTIONS, KEY_OF, PRESETS, applyGrant, offered, setAction, signature } from './rolePresets'
import { SaveBar, TeamHeader, ToggleRow } from './teamParts'
import { useRolePermissions, useRoles, useSaveRolePermissions } from './teamQueries'
import { errorText } from './teamUtils'

export function RolePermissionsPage() {
  const { roleId = '' } = useParams<{ roleId: string }>()
  const roles = useRoles()
  const permissions = useRolePermissions(roleId)
  const role = roles.data?.find((r) => r.id === roleId)
  const failed = roles.error ?? permissions.error

  return (
    <div className="flex h-full flex-col">
      <TeamHeader title={role ? `${role.role} permissions` : 'Role permissions'} subtitle="What people in this role can see and do." backTo="/admin/roles" />
      {roles.isLoading || permissions.isLoading ? (
        <PageLoader label="Loading permissions…" />
      ) : role && permissions.data ? (
        <Editor key={role.id} role={role} saved={permissions.data} />
      ) : (
        <div className="space-y-3 px-4 py-10 text-center">
          <p className="text-[13px] text-[var(--text-muted)]">{failed ? errorText(failed) : 'Role not found.'}</p>
          {failed && (
            <Button variant="secondary" size="sm" onClick={() => void Promise.all([roles.refetch(), permissions.refetch()])}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

const chip = 'h-9 shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] px-3.5 text-[12.5px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]'

function Editor({ role, saved }: { role: TeamRole; saved: RolePermission[] }) {
  const toast = useToast()
  const save = useSaveRolePermissions(role.id)
  // null = not edited, so the page shows what is saved.
  const [edited, setEdited] = useState<RolePermission[] | null>(null)
  const [scopeEdited, setScopeEdited] = useState<boolean | null>(null)
  const rows = edited ?? saved
  const byName = role.sees_all_by_name === true
  const seesAll = byName || (scopeEdited ?? role.sees_all_data ?? false)
  const scopeDirty = scopeEdited !== null && scopeEdited !== (role.sees_all_data ?? false)
  const dirty = scopeDirty || (edited !== null && signature(edited) !== signature(saved))

  const groups = new Map<string, RolePermission[]>()
  for (const row of rows) groups.set(row.group ?? 'Features', [...(groups.get(row.group ?? 'Features') ?? []), row])

  const total = rows.reduce((n, r) => n + offered(r).length, 0)
  const on = rows.reduce((n, r) => n + offered(r).filter((a) => r[KEY_OF[a]]).length, 0)

  function change(update: (row: RolePermission) => RolePermission, features?: Set<string>) {
    setEdited(rows.map((row) => (!features || features.has(row.feature) ? update(row) : row)))
  }

  function toggle(row: RolePermission, action: PermissionAction) {
    change((r) => setAction(r, action, !r[KEY_OF[action]]), new Set([row.feature]))
  }

  function discard() {
    setEdited(null)
    setScopeEdited(null)
  }

  function submit() {
    save.mutate(
      { permissions: rows, ...(scopeDirty ? { seesAllData: scopeEdited as boolean } : {}) },
      {
        onSuccess: () => {
          discard()
          toast.show({ title: 'Permissions saved', description: 'People in this role get the change when they next open or reload the app.', tone: 'success' })
        },
        onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
      },
    )
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 md:px-6">
          <div className="rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
            <ToggleRow
              title="Can see everyone’s data"
              text={
                byName
                  ? 'This role is named “manager”, so it always sees everyone’s records.'
                  : 'Off: only records assigned to them. On: everyone’s records, to read only. Changing someone else’s record stays with admins.'
              }
              checked={seesAll}
              disabled={byName}
              onChange={setScopeEdited}
            />
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <Eye size={13} aria-hidden /> Start from a ready-made set
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button key={preset.name} type="button" title={preset.hint} onClick={() => change((r) => applyGrant(r, preset.grants(r.feature)))} className={chip}>
                  {preset.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">Change any button afterwards, then save.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => change((r) => applyGrant(r, 'all'))} className={chip}>
              Select all
            </button>
            <button type="button" onClick={() => change((r) => applyGrant(r, []))} className={chip}>
              Clear all
            </button>
            <span className="ml-auto text-[12.5px] text-[var(--text-muted)]">
              <span className="font-mono-num font-semibold text-[var(--text-h)]">{on}</span> of {total} switched on
            </span>
          </div>

          {[...groups.entries()].map(([group, groupRows]) => {
            const features = new Set(groupRows.map((r) => r.feature))
            const allOn = groupRows.every((r) => offered(r).every((a) => r[KEY_OF[a]]))
            return (
              <section key={group} className="rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2">
                  <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{group}</h2>
                  <button type="button" onClick={() => change((r) => applyGrant(r, allOn ? [] : 'all'), features)} className="h-9 px-1 text-[12.5px] font-medium text-[var(--accent-strong)]">
                    {allOn ? 'Clear section' : 'Select section'}
                  </button>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {groupRows.map((row) => (
                    <li key={row.feature} className="px-4 py-3">
                      <p className="text-[13.5px] font-semibold text-[var(--text-h)]">{row.label ?? row.feature}</p>
                      {row.description && <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">{row.description}</p>}
                      {/* Four equal columns, so each action sits in the same place on every feature. */}
                      <div className="mt-2.5 grid max-w-sm grid-cols-4 gap-1.5">
                        {ACTIONS.map((a) => {
                          if (!offered(row).includes(a.action)) return <span key={a.action} />
                          const selected = row[a.key]
                          return (
                            <button
                              key={a.action}
                              type="button"
                              aria-pressed={selected}
                              aria-label={`${row.label ?? row.feature}: ${a.label}`}
                              onClick={() => toggle(row, a.action)}
                              className={cn(
                                'h-10 rounded-lg border text-[12.5px] font-medium transition-colors',
                                selected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
                              )}
                            >
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          <p className="text-[12px] text-[var(--text-muted)]">
            Admins always have everything. “Leads → Add” doesn’t stop executives adding leads assigned to themselves on pipelines they belong to.
          </p>
        </div>
      </div>

      <SaveBar note={dirty ? <span className="font-medium text-[var(--warning)]">Unsaved changes</span> : 'No changes yet'}>
        <Button variant="secondary" onClick={discard} disabled={!dirty || save.isPending}>
          Discard
        </Button>
        <Button onClick={submit} disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save permissions'}
        </Button>
      </SaveBar>
    </>
  )
}
