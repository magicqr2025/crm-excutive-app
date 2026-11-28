import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ban, ChevronRight, Phone, Plus, Search, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'
import type { TeamMember } from '@/api/teamApi'
import { TeamHeader } from './teamParts'
import { useSetStaffAvailability, useTeam } from './teamQueries'
import { SELECT_CLASSES, availabilityOf, errorText, staffName } from './teamUtils'

type StatusFilter = 'all' | 'active' | 'not_working' | 'inactive'

export function StaffListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: staff = [], isLoading, isError, error, refetch } = useTeam()
  const setAvailability = useSetStaffAvailability()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [role, setRole] = useState('')

  const active = staff.filter((m) => m.status === '1')
  const counts: { value: StatusFilter; label: string; n: number }[] = [
    { value: 'all', label: 'All staff', n: staff.length },
    { value: 'active', label: 'Active', n: active.length },
    { value: 'not_working', label: 'Not working', n: active.filter((m) => m.on_leave).length },
    { value: 'inactive', label: 'Inactive', n: staff.length - active.length },
  ]

  const roleNames = useMemo(() => [...new Set(staff.map((m) => m.user_role_type_name).filter((r): r is string => !!r))].sort(), [staff])

  // Sorted by name, so rows don't move when someone is updated and the next tap hits the same person.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return [...staff]
      .sort((a, b) => staffName(a).localeCompare(staffName(b)) || Number(a.user_id) - Number(b.user_id))
      .filter((m) => {
        const state = availabilityOf(m)
        if (status === 'active' && state === 'inactive') return false
        if ((status === 'inactive' || status === 'not_working') && state !== status) return false
        if (role && m.user_role_type_name !== role) return false
        return !term || [staffName(m), m.user_email, m.user_phone, m.user_role_type_name].some((v) => v?.toLowerCase().includes(term))
      })
  }, [staff, search, status, role])

  // Only changes who gets NEW leads; leads they already have stay with them.
  function changeWorking(member: TeamMember, notWorking: boolean) {
    const name = staffName(member)
    setAvailability.mutate(
      { userId: member.user_id, patch: { on_leave: notWorking } },
      {
        onSuccess: () => toast.show({ title: notWorking ? `${name} is not working — no new leads` : `${name} is working — new leads resume`, tone: 'success' }),
        onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
      },
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader
        title="Staff"
        subtitle="Your team's logins and access."
        backTo="/admin"
        action={
          <Button onClick={() => navigate('/admin/staff/new')}>
            <Plus size={15} /> Add staff
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-10 pt-4 md:px-6">
        {/* Each count is also a filter. */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {counts.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={status === c.value}
              onClick={() => setStatus((current) => (current === c.value ? 'all' : c.value))}
              className={cn('rounded-xl border px-3.5 py-3 text-left transition-colors', status === c.value ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border)] bg-[var(--surface)]')}
            >
              <span className="block font-mono-num text-[22px] font-semibold leading-none text-[var(--text-h)]">{isLoading ? '–' : c.n}</span>
              <span className="mt-1.5 block text-[12px] text-[var(--text-muted)]">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone…" aria-label="Search staff" className="h-11 pl-9" />
          </div>
          {roleNames.length > 1 && (
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className={cn(SELECT_CLASSES, 'sm:w-48')}>
              <option value="">All roles</option>
              {roleNames.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </div>

        {isLoading ? (
          <PageLoader label="Loading staff…" />
        ) : isError ? (
          <div className="space-y-3 py-10 text-center">
            <p className="text-[13px] text-[var(--error)]">{errorText(error)}</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">{staff.length === 0 ? 'No staff yet. Add your first staff member.' : 'No staff member matches these filters.'}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visible.map((member) => {
              const name = staffName(member)
              const state = availabilityOf(member)
              return (
                <li key={member.user_id} className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
                  <Link to={`/admin/staff/${member.user_id}`} aria-label={`Edit ${name}`} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                    <Avatar name={name} size={42} className={cn(state === 'inactive' && 'opacity-50 grayscale')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14.5px] font-semibold text-[var(--text-h)]">{name}</span>
                        {member.is_admin && <ShieldCheck size={14} aria-label="Admin" className="shrink-0 text-[var(--accent-strong)]" />}
                      </span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">{member.user_email ?? '—'}</span>
                      {member.user_phone && (
                        <span className="flex items-center gap-1 font-mono-num text-[12px] text-[var(--text-muted)]">
                          <Phone size={11} aria-hidden /> {member.user_phone}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={17} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
                  </Link>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {member.user_role_type_name && <Badge tone="info">{member.user_role_type_name}</Badge>}
                    {member.is_owner ? <Badge tone="accent">Owner</Badge> : member.is_admin && <Badge tone="accent">Admin</Badge>}
                    {state !== 'inactive' && member.receives_leads === false && (
                      <Badge tone="error">
                        <Ban size={11} aria-hidden /> Leads off
                      </Badge>
                    )}
                  </div>

                  {state === 'inactive' ? (
                    <p className="mt-auto text-[12.5px] text-[var(--text-muted)]">Inactive account</p>
                  ) : (
                    <div role="group" aria-label={`${name} availability`} className="mt-auto grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] p-1">
                      {[
                        { notWorking: false, label: 'Working', on: 'bg-[var(--success)] text-white' },
                        { notWorking: true, label: 'Not working', on: 'bg-[var(--error)] text-white' },
                      ].map((o) => {
                        const selected = (state === 'not_working') === o.notWorking
                        return (
                          <button
                            key={o.label}
                            type="button"
                            aria-pressed={selected}
                            disabled={setAvailability.isPending}
                            onClick={() => !selected && changeWorking(member, o.notWorking)}
                            className={cn('h-9 rounded-lg text-[12.5px] font-medium transition-colors disabled:opacity-60', selected ? o.on : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]')}
                          >
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
