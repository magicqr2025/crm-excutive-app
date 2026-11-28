import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { TeamHeader } from './teamParts'
import { useCreateRole, useRoles } from './teamQueries'
import { errorText } from './teamUtils'

export function RolesPage() {
  const { data: roles = [], isLoading, isError, error, refetch } = useRoles()
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader
        title="Roles & Permissions"
        subtitle="Choose what each role can see and do."
        backTo="/admin"
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={15} /> Add role
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4 md:px-6">
        {isLoading ? (
          <PageLoader label="Loading roles…" />
        ) : isError ? (
          <div className="space-y-3 py-10 text-center">
            <p className="text-[13px] text-[var(--error)]">{errorText(error)}</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : roles.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">No roles yet. Add your first role.</p>
        ) : (
          <ul className="space-y-2.5">
            {roles.map((role) => (
              <li key={role.id}>
                <Link
                  to={`/admin/roles/${role.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-[var(--surface)] px-3.5 py-3 ring-1 ring-[var(--border)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <ShieldCheck size={18} aria-hidden className="shrink-0 text-[var(--accent-strong)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-[var(--text-h)]">{role.role}</span>
                    <span className="block text-[12px] text-[var(--text-muted)]">
                      {role.sees_all_by_name || role.sees_all_data ? 'Can see everyone’s data' : 'Sees only their own records'}
                    </span>
                  </span>
                  <ChevronRight size={17} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {adding && <AddRoleDialog onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddRoleDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateRole()
  const [name, setName] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || create.isPending) return
    create.mutate(name.trim(), {
      onSuccess: (role) => {
        toast.show({ title: 'Role created. Now choose its permissions.', tone: 'success' })
        navigate(`/admin/roles/${role.id}`)
      },
      onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
    })
  }

  return (
    <Dialog open onClose={onClose} variant="sheet" className="sm:max-w-sm">
      <Dialog.Header>
        <Dialog.Title>Add role</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <form onSubmit={submit}>
        <Dialog.Body>
          <Field label="Role name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Field Staff" className="h-11" />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="submit" className="w-full justify-center" disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Saving…' : 'Add role'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  )
}
