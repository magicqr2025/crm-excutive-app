import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { createFlag, deleteFlag, fetchFlags, updateFlag, type Flag } from '@/api/leadSetupApi'
import { ToggleRow } from '@/features/team/teamParts'
import { ColorPicker, ConfirmDialog, SetupPage } from './setupParts'
import { PALETTE } from './palette'
import { useSetupAction } from './useSetupAction'

const REFRESH = ['setup-flags', 'lead-flags']

export function FlagsPage() {
  const query = useQuery({ queryKey: ['setup-flags'], queryFn: fetchFlags })
  const flags = (query.data ?? []).filter((f) => !f.deleted).sort((a, b) => a.sort_order - b.sort_order)
  const [editing, setEditing] = useState<Flag | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Flag | null>(null)
  const toggle = useSetupAction((input: { id: string; active: boolean }) => updateFlag(input.id, { active: input.active }), 'Flag updated', REFRESH)
  const remove = useSetupAction((flagId: string) => deleteFlag(flagId), 'Flag deleted', REFRESH)

  return (
    <SetupPage
      title="Flags"
      subtitle="Call flags your team puts on leads."
      query={query}
      action={
        <Button onClick={() => setEditing('new')}>
          <Plus size={15} /> Add flag
        </Button>
      }
    >
      {flags.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">No flags yet.</p>
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => (
            <li key={flag.id} className="rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
              <div className="flex items-center gap-2.5 px-3.5 pt-3">
                <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: flag.color || PALETTE[9] }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-[var(--text-h)]">{flag.name}</span>
                  <span className="block text-[12px] text-[var(--text-muted)]">
                    {flag.lead_count ?? 0} lead{flag.lead_count === 1 ? '' : 's'}
                  </span>
                </span>
                <button type="button" onClick={() => setEditing(flag)} aria-label={`Edit ${flag.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
                  <Pencil size={15} />
                </button>
                <button type="button" onClick={() => setDeleting(flag)} aria-label={`Delete ${flag.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--error)] hover:bg-[var(--surface-hover)]">
                  <Trash2 size={15} />
                </button>
              </div>
              <ToggleRow
                title={flag.active ? 'On' : 'Off'}
                text={flag.active ? 'Can be picked on a lead.' : 'Leads keep it, but it can’t be picked.'}
                checked={flag.active}
                disabled={toggle.isPending}
                onChange={(active) => toggle.mutate({ id: flag.id, active })}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && <FlagDialog flag={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete flag?"
          confirmLabel="Delete"
          busy={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        >
          No one will be able to pick “{deleting.name}” any more. Leads that already have it ({deleting.lead_count ?? 0}) keep it.
        </ConfirmDialog>
      )}
    </SetupPage>
  )
}

function FlagDialog({ flag, onClose }: { flag: Flag | null; onClose: () => void }) {
  const [name, setName] = useState(flag?.name ?? '')
  const [color, setColor] = useState(flag?.color || PALETTE[3])
  const save = useSetupAction(
    () => (flag ? updateFlag(flag.id, { name: name.trim(), color }) : createFlag({ name: name.trim(), color })),
    flag ? 'Flag updated' : 'Flag added',
    REFRESH,
  )
  const close = () => !save.isPending && onClose()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim() && !save.isPending) save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Dialog open onClose={close} variant="sheet" className="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{flag ? 'Edit flag' : 'Add flag'}</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <form onSubmit={submit}>
        <Dialog.Body className="space-y-4">
          <Field label="Name *" hint={flag ? 'Changes it on every lead that has it.' : undefined}>
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hot lead" className="h-11" />
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
