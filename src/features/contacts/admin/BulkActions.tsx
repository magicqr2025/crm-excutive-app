import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, Tag, UserMinus, UserPlus, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useContactGroups, useLabels, useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import { addLeadsToContactGroup } from '@/api/crmApi'
import * as setupApi from '@/api/leadSetupApi'
import { splitNames } from './importRows'
import { fetchTeam } from '@/api/teamApi'
import { staffName, SELECT_CLASSES } from '@/features/team/teamUtils'
import { cn } from '@/lib/utils'

type Action = 'staff' | 'status' | 'label' | 'group' | 'remove'

/** The server takes at most this many labels per request. */
const MAX_LABELS = 20

const plural = (n: number) => `${n} contact${n === 1 ? '' : 's'}`

/**
 * Admin actions on the ticked contacts, in a bar that stays at the bottom of the screen.
 * `group` is the group the list is filtered to, which allows taking contacts out of it.
 */
export function BulkActionBar({ leadIds, group, onDone }: { leadIds: string[]; group: { id: string; name: string } | null; onDone: () => void }) {
  const [action, setAction] = useState<Action | null>(null)
  if (leadIds.length === 0) return null
  const buttons: { action: Action; label: string; icon: typeof Flag }[] = [
    { action: 'staff', label: 'Assign staff', icon: UserPlus },
    { action: 'status', label: 'Status', icon: Flag },
    { action: 'label', label: 'Label', icon: Tag },
    { action: 'group', label: 'Add to group', icon: UsersRound },
    ...(group ? [{ action: 'remove' as const, label: 'Remove from group', icon: UserMinus }] : []),
  ]
  return (
    <>
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-[var(--accent-border)] bg-[var(--surface)] px-4 py-2.5 shadow-[0_-8px_20px_-14px_rgba(0,0,0,0.35)]">
        <p className="mb-1.5 text-[12px] font-medium text-[var(--accent-strong)]">{plural(leadIds.length)} selected</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {buttons.map(({ action: value, label, icon: Icon }) => (
            <Button key={value} variant="secondary" className="shrink-0" onClick={() => setAction(value)}>
              <Icon size={14} /> {label}
            </Button>
          ))}
        </div>
      </div>
      {action && <BulkDialog action={action} leadIds={leadIds} group={group} onClose={() => setAction(null)} onDone={onDone} />}
    </>
  )
}

interface Outcome {
  title: string
  description?: string
}

function BulkDialog({
  action,
  leadIds,
  group,
  onClose,
  onDone,
}: {
  action: Action
  leadIds: string[]
  group: { id: string; name: string } | null
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const team = useQuery({ queryKey: ['team', 'staff'], queryFn: fetchTeam, enabled: action === 'staff' })
  const { data: statuses = [] } = useLeadStatuses()
  const { data: labels = [] } = useLabels()
  const { data: groups = [] } = useContactGroups()
  const [choice, setChoice] = useState('')
  const { data: stages = [] } = useLeadStageTypes()
  // Assign status: the stage is picked first, then one of its statuses.
  const [stageId, setStageId] = useState('')
  const stageStatuses = statuses.filter((s) => s.status !== '0' && s.stage_id === stageId).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  const [pickedLabels, setPickedLabels] = useState<string[]>([])
  const [newLabels, setNewLabels] = useState('')
  const count = leadIds.length

  const colleagues = (team.data ?? []).filter((m) => m.status === '1').sort((a, b) => staffName(a).localeCompare(staffName(b)))
  const typed = splitNames(newLabels)
  const labelTotal = pickedLabels.length + typed.length

  const run = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      if (action === 'staff') {
        const { updated_count } = await setupApi.bulkAssignStaff(leadIds, choice)
        return { title: `${plural(updated_count)} assigned` }
      }
      if (action === 'status') {
        const { updated_count, skipped_count } = await setupApi.bulkSetStatus(leadIds, choice)
        return { title: `Status set on ${plural(updated_count)}`, description: skipped_count ? `${skipped_count} skipped` : undefined }
      }
      if (action === 'label') {
        // Typed names are created if new; an existing name is matched without regard to capitals.
        const made = typed.length ? await setupApi.addLabels(typed) : []
        const ids = [...new Set([...pickedLabels, ...made.map((l) => l.id)])]
        const result = await setupApi.bulkAddLabels(leadIds, ids)
        const extra = [result.already_had ? `${result.already_had} already had them` : '', result.not_found ? `${result.not_found} not found` : ''].filter(Boolean).join(', ')
        return { title: `Labels added to ${plural(result.labelled)}`, description: extra || undefined }
      }
      if (action === 'group') {
        const { added } = await addLeadsToContactGroup(choice, leadIds)
        return { title: `${plural(added)} added to the group` }
      }
      const { removed } = await setupApi.removeFromGroup(group?.id ?? '', leadIds)
      return { title: `${plural(removed)} removed from ${group?.name}` }
    },
    onSuccess: (outcome) => {
      toast.show({ ...outcome, tone: 'success' })
      // Owners, statuses, labels and counts can all have changed.
      void queryClient.invalidateQueries()
      onDone()
      onClose()
    },
    onError: (err) => toast.show({ title: err instanceof Error ? err.message : 'Something went wrong', tone: 'error' }),
  })

  const copy: Record<Action, { title: string; text: string; confirm: string }> = {
    staff: { title: 'Assign staff', text: 'Their meetings, follow-ups and chats move with them.', confirm: 'Assign' },
    status: { title: 'Assign status', text: 'Sets one lead status on all of them.', confirm: 'Set status' },
    label: { title: 'Assign labels', text: 'Labels they already have are kept.', confirm: 'Add labels' },
    group: { title: 'Add to group', text: 'They stay in any other group they are in.', confirm: 'Add to group' },
    remove: { title: 'Remove from group', text: `They are taken out of ${group?.name}. The contacts are not deleted.`, confirm: 'Remove' },
  }
  const ready = action === 'remove' ? !!group : action === 'label' ? labelTotal > 0 && labelTotal <= MAX_LABELS : !!choice

  const select = (label: string, options: { id: string; name: string }[], empty: string, disabled = false): ReactNode => (
    <Field label={label}>
      <select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={disabled} className={cn(SELECT_CLASSES, 'disabled:opacity-60')}>
        <option value="" disabled>
          {options.length ? 'Choose…' : empty}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  )

  const close = () => !run.isPending && onClose()

  return (
    <Dialog open onClose={close} variant="sheet" className="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{copy[action].title}</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3">
        <p className="text-[13px] text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-h)]">{plural(count)} selected.</span> {copy[action].text}
        </p>
        {action === 'staff' &&
          select(
            'Staff member',
            colleagues.map((m) => ({ id: m.user_id, name: m.is_admin ? `${staffName(m)} (Admin)` : staffName(m) })),
            team.isLoading ? 'Loading staff…' : 'No active staff',
          )}
        {action === 'status' && (
          <>
            <Field label="Lead stage">
              <select
                value={stageId}
                onChange={(e) => {
                  setStageId(e.target.value)
                  // A status belongs to one stage, so the earlier pick no longer applies.
                  setChoice('')
                }}
                className={SELECT_CLASSES}
              >
                <option value="" disabled>
                  {stages.length ? 'Choose…' : 'No stages'}
                </option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lead_stage}
                  </option>
                ))}
              </select>
            </Field>
            {select(
              'Lead status',
              stageStatuses.map((s) => ({ id: s.id, name: s.lead_status })),
              stageId ? 'No statuses in this stage' : 'Choose a stage first',
              !stageId,
            )}
          </>
        )}
        {action === 'group' && select('Group', groups, 'No groups yet. Add one under Admin.')}
        {action === 'label' && (
          <>
            {labels.length > 0 && (
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {labels.map((l) => {
                  const on = pickedLabels.includes(l.id)
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPickedLabels((ids) => (on ? ids.filter((x) => x !== l.id) : [...ids, l.id]))}
                      className={cn('h-9 rounded-full border px-3 text-[12.5px]', on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--text-h)]')}
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            )}
            <Field label="New labels" hint="Separate several with commas." error={labelTotal > MAX_LABELS ? `Choose at most ${MAX_LABELS} labels at a time.` : undefined}>
              <Input value={newLabels} onChange={(e) => setNewLabels(e.target.value)} placeholder="e.g. VIP, Webinar" className="h-11" />
            </Field>
          </>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={close} disabled={run.isPending}>
          Cancel
        </Button>
        <Button onClick={() => run.mutate()} disabled={!ready || run.isPending}>
          {run.isPending ? 'Saving…' : copy[action].confirm}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
