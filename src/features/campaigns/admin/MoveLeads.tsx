import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useMyLeadCampaigns } from '@/api/queries'
import { moveLeads, type MoveAssignMode } from '@/api/pipelineLeadsApi'
import { useTeam } from '@/features/team/teamQueries'
import { SELECT_CLASSES, errorText, staffName } from '@/features/team/teamUtils'
import { StageStatusFields, type StageStatus } from './StageStatusFields'

const plural = (n: number) => `${n} lead${n === 1 ? '' : 's'}`

/** The bar under a pipeline's leads list once an admin has ticked some. */
export function MoveLeadsBar({ pipelineId, leadIds, onClear, onMoved }: { pipelineId: string; leadIds: string[]; onClear: () => void; onMoved: () => void }) {
  const [open, setOpen] = useState(false)
  if (leadIds.length === 0) return null
  return (
    <>
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--accent-border)] bg-[var(--surface)] px-4 py-2.5 shadow-[0_-8px_20px_-14px_rgba(0,0,0,0.35)]">
        <p className="mr-auto text-[12.5px] font-medium text-[var(--accent-strong)]">{plural(leadIds.length)} selected</p>
        <Button variant="secondary" onClick={onClear}>
          Clear
        </Button>
        <Button onClick={() => setOpen(true)}>
          <ArrowRightLeft size={14} /> Move
        </Button>
      </div>
      {open && <MoveDialog pipelineId={pipelineId} leadIds={leadIds} onClose={() => setOpen(false)} onMoved={onMoved} />}
    </>
  )
}

function MoveDialog({ pipelineId, leadIds, onClose, onMoved }: { pipelineId: string; leadIds: string[]; onClose: () => void; onMoved: () => void }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: pipelines = [] } = useMyLeadCampaigns()
  const team = useTeam()
  const [destinationId, setDestinationId] = useState('')
  // '' choices are "follow the destination's rule" / "keep the same person"; anything else is a staff id.
  const [assign, setAssign] = useState<string>('follow_destination')
  const [status, setStatus] = useState<StageStatus>({ stageId: '', statusId: '' })

  const destinations = pipelines.filter((p) => p.id !== pipelineId)
  const staff = (team.data ?? []).filter((m) => m.status === '1').sort((a, b) => staffName(a).localeCompare(staffName(b)))
  const mode: MoveAssignMode = assign === 'follow_destination' || assign === 'keep_same' ? assign : 'specific'
  const ready = !!destinationId && !(status.stageId && !status.statusId)

  const move = useMutation({
    mutationFn: () => moveLeads({ leadIds, destinationId, assignMode: mode, staffId: mode === 'specific' ? assign : undefined, leadStatusId: status.statusId || undefined }),
    onSuccess: (result) => {
      toast.show({ title: `${plural(result.moved_count)} moved`, tone: 'success' })
      void queryClient.invalidateQueries()
      onMoved()
      onClose()
    },
    onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
  })
  const close = () => !move.isPending && onClose()

  return (
    <Dialog open onClose={close} className="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>Move {plural(leadIds.length)}</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        <Field label="Destination pipeline">
          <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={SELECT_CLASSES}>
            <option value="" disabled>
              {destinations.length ? 'Choose…' : 'There is no other pipeline'}
            </option>
            {destinations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Who gets them"
          hint={
            mode === 'follow_destination'
              ? 'An owner who is on that pipeline keeps the lead. Otherwise its distribution rule decides, which may leave the lead unassigned.'
              : mode === 'keep_same'
                ? 'Owners stay as they are.'
                : 'Ownership of every selected lead moves to this person.'
          }
        >
          <select value={assign} onChange={(e) => setAssign(e.target.value)} className={SELECT_CLASSES}>
            <option value="follow_destination">Follow the destination’s rule</option>
            <option value="keep_same">Keep the same person</option>
            <optgroup label="Give to">
              {staff.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {staffName(m)}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <StageStatusFields value={status} onChange={setStatus} noneLabel="Keep current status" />
        <p className="rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">The destination becomes these leads’ main pipeline.</p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={close} disabled={move.isPending}>
          Cancel
        </Button>
        <Button onClick={() => move.mutate()} disabled={!ready || move.isPending}>
          {move.isPending ? 'Moving…' : 'Move'}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
