import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { createGroup, deleteGroup, fetchGroups, updateGroup, type Group } from '@/api/leadSetupApi'
import { ColorPicker, ConfirmDialog, SetupPage } from './setupParts'
import { PALETTE } from './palette'
import { useSetupAction } from './useSetupAction'

const REFRESH = ['setup-groups', 'contact-groups']

export function GroupsPage() {
  const query = useQuery({ queryKey: ['setup-groups'], queryFn: fetchGroups })
  const groups = query.data ?? []
  const [editing, setEditing] = useState<Group | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)
  const remove = useSetupAction((groupId: string) => deleteGroup(groupId), 'Group deleted', REFRESH)

  return (
    <SetupPage
      title="Contact Groups"
      subtitle="To fill a group, select contacts on the Contacts page."
      query={query}
      action={
        <Button onClick={() => setEditing('new')}>
          <Plus size={15} /> Add group
        </Button>
      }
    >
      {groups.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">No groups yet.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id} className="flex items-center gap-2.5 rounded-2xl bg-[var(--surface)] py-2.5 pl-3.5 pr-2 ring-1 ring-[var(--border)]">
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: group.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-[var(--text-h)]">{group.name}</span>
                <span className="block truncate text-[12px] text-[var(--text-muted)]">
                  {group.member_count ?? 0} contact{group.member_count === 1 ? '' : 's'}
                  {group.description ? ` · ${group.description}` : ''}
                </span>
              </span>
              <button type="button" onClick={() => setEditing(group)} aria-label={`Edit ${group.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
                <Pencil size={15} />
              </button>
              <button type="button" onClick={() => setDeleting(group)} aria-label={`Delete ${group.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--error)] hover:bg-[var(--surface-hover)]">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <GroupDialog group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete group?"
          confirmLabel="Delete"
          busy={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        >
          The group “{deleting.name}” will be deleted. Its contacts are not deleted.
        </ConfirmDialog>
      )}
    </SetupPage>
  )
}

function GroupDialog({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [color, setColor] = useState(group?.color || PALETTE[3])
  const save = useSetupAction(
    () => {
      const input = { name: name.trim(), description: description.trim() || null, color }
      return group ? updateGroup(group.id, input) : createGroup(input)
    },
    group ? 'Group updated' : 'Group added',
    REFRESH,
  )
  const close = () => !save.isPending && onClose()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim() && !save.isPending) save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Dialog open onClose={close} className="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{group ? 'Edit group' : 'Add group'}</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <Dialog.Body className="space-y-4">
          <Field label="Name *">
            <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="h-11" />
          </Field>
          <Field label="Description">
            <Textarea value={description} maxLength={500} rows={3} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Colour">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="submit" className="w-full justify-center" disabled={!name.trim() || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  )
}
