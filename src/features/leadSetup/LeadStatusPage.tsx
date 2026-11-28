import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Star } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import type { CrmLeadStageType, CrmLeadStatus } from '@/api/crmApi'
import { createStatus, updateStatus } from '@/api/leadSetupApi'
import { SELECT_CLASSES } from '@/features/team/teamUtils'
import { cn } from '@/lib/utils'
import { ColorPicker, ConfirmDialog, SetupPage } from './setupParts'
import { PALETTE } from './palette'
import { useSetupAction } from './useSetupAction'

const REFRESH = ['lead-statuses']

export function LeadStatusPage() {
  const statuses = useLeadStatuses()
  const stages = useLeadStageTypes()
  // null = closed; 'new' = adding.
  const [editing, setEditing] = useState<CrmLeadStatus | 'new' | null>(null)
  const [turningOff, setTurningOff] = useState<CrmLeadStatus | null>(null)
  const change = useSetupAction((input: { id: string; active?: boolean; isDefault?: boolean }) => updateStatus(input.id, input), 'Status updated', REFRESH)

  const query = {
    isLoading: statuses.isLoading || stages.isLoading,
    isError: statuses.isError || stages.isError,
    error: statuses.error ?? stages.error,
    refetch: () => Promise.all([statuses.refetch(), stages.refetch()]),
  }

  return (
    <SetupPage
      title="Lead Status"
      subtitle="The statuses your team puts on leads, by stage."
      query={query}
      action={
        <Button onClick={() => setEditing('new')} disabled={!stages.data?.length}>
          <Plus size={15} /> Add status
        </Button>
      }
    >
      {(stages.data ?? []).map((stage) => {
        const items = (statuses.data ?? []).filter((s) => s.stage_id === stage.id).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        return (
          <section key={stage.id} className="rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
            <h2 className="border-b border-[var(--border)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{stage.lead_stage}</h2>
            {items.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-[var(--text-muted)]">No statuses in this stage yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {items.map((s) => {
                  const off = s.status === '0'
                  return (
                    <li key={s.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span aria-hidden className={cn('h-3 w-3 shrink-0 rounded-full', off && 'opacity-40')} style={{ background: s.color || PALETTE[0] }} />
                        <span className={cn('min-w-0 flex-1 truncate text-[14px] font-medium', off ? 'text-[var(--text-muted)]' : 'text-[var(--text-h)]')}>{s.lead_status}</span>
                        {s.is_default && <Badge tone="accent">Default</Badge>}
                        {off && <Badge tone="neutral">Off</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>
                          <Pencil size={13} /> Edit
                        </Button>
                        {!off && !s.is_default && (
                          <Button variant="secondary" size="sm" disabled={change.isPending} onClick={() => change.mutate({ id: s.id, isDefault: true })}>
                            <Star size={13} /> Make default
                          </Button>
                        )}
                        {off ? (
                          <Button variant="secondary" size="sm" disabled={change.isPending} onClick={() => change.mutate({ id: s.id, active: true })}>
                            Turn on
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setTurningOff(s)}>
                            Turn off
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      {editing && <StatusDialog status={editing === 'new' ? null : editing} stages={stages.data ?? []} onClose={() => setEditing(null)} />}
      {turningOff && (
        <ConfirmDialog
          title="Turn off status?"
          confirmLabel="Turn off"
          busy={change.isPending}
          onClose={() => setTurningOff(null)}
          onConfirm={() => change.mutate({ id: turningOff.id, active: false }, { onSuccess: () => setTurningOff(null) })}
        >
          “{turningOff.lead_status}” won’t be offered for new changes. You can turn it on again here.
        </ConfirmDialog>
      )}
    </SetupPage>
  )
}

function StatusDialog({ status, stages, onClose }: { status: CrmLeadStatus | null; stages: CrmLeadStageType[]; onClose: () => void }) {
  const [name, setName] = useState(status?.lead_status ?? '')
  const [color, setColor] = useState(status?.color || PALETTE[3])
  const [sequence, setSequence] = useState(String(status?.sequence ?? 1))
  const [stageId, setStageId] = useState(status?.stage_id ?? stages[0]?.id ?? '')
  const save = useSetupAction(
    () => {
      const input = { name: name.trim(), color, sequence: Number(sequence) || 1, stageId }
      return status ? updateStatus(status.id, input) : createStatus(input)
    },
    status ? 'Status updated' : 'Status added',
    REFRESH,
  )
  const close = () => !save.isPending && onClose()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim() && stageId && !save.isPending) save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Dialog open onClose={close} className="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{status ? 'Edit status' : 'Add status'}</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <Dialog.Body className="space-y-4">
          <Field label="Name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </Field>
          <Field label="Stage">
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={SELECT_CLASSES}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lead_stage}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order" hint="Lower numbers come first.">
            <Input type="number" inputMode="numeric" min="1" value={sequence} onChange={(e) => setSequence(e.target.value)} className="h-11" />
          </Field>
          <Field label="Colour">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="submit" className="w-full justify-center" disabled={!name.trim() || !stageId || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  )
}
