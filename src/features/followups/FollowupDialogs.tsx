import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { useCreateFollowup, useFollowup, useUpdateFollowup } from '@/api/queries'
import type { CrmFollowup } from '@/api/crmApi'
import { FollowupWhenPicker, initialWhen, resolveWhen, whenIsValid, type When } from './FollowupWhenPicker'
import { useLeadUpdate, useSaveLeadChanges } from './LeadUpdatePanel'
import { FOLLOWUP_FORM_TEXT } from './followupUi'

// Complete + Reschedule for one follow-up (ported from orm-whatsapp). Staff always own the next follow-up,
// so there is no "who follows up" picker.

interface DialogProps {
  followup: CrmFollowup | null
  onClose: () => void
}

export function CompleteFollowupDialog({ followup, onClose }: DialogProps) {
  return (
    <Dialog open={Boolean(followup)} onClose={onClose}>
      {followup && <CompleteForm key={followup.id} followup={followup} onClose={onClose} />}
    </Dialog>
  )
}

function CompleteForm({ followup, onClose }: { followup: CrmFollowup; onClose: () => void }) {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const update = useUpdateFollowup()
  const create = useCreateFollowup()
  const { show } = useToast()
  const [note, setNote] = useState('')
  const [addNext, setAddNext] = useState(false)
  const [when, setWhen] = useState<When>(initialWhen)
  // List rows don't carry the lead id; the single follow-up does, so look it up when it's missing.
  const { data: full, isLoading: loadingFull } = useFollowup(followup.lead_id ? '' : followup.id)
  const leadUpdate = useLeadUpdate(followup.lead_id ?? full?.lead_id, loadingFull)
  const saveLeadChanges = useSaveLeadChanges()
  const [savingLead, setSavingLead] = useState(false)
  const saving = update.isPending || create.isPending || savingLead
  const valid = note.trim() !== '' && (!addNext || whenIsValid(when)) && !leadUpdate.invalid

  function submit() {
    if (!valid) return
    const next = addNext ? resolveWhen(when) : null
    const leadChanges = leadUpdate.changes()
    update.mutate(
      { id: followup.id, patch: { status: '2', note: note.trim() } },
      {
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not complete follow-up', tone: 'error' }),
        onSuccess: async () => {
          // The follow-up is done either way; a lead change that is refused is reported on its own.
          if (leadChanges) {
            setSavingLead(true)
            const failed = await saveLeadChanges(leadChanges)
            setSavingLead(false)
            if (failed.length) show({ title: 'Follow-up completed, but the lead was not fully updated', description: `Could not save: ${failed.join(', ')}.`, tone: 'error' })
          }
          if (!next) {
            show({ title: 'Follow-up completed', tone: 'success' })
            return onClose()
          }
          create.mutate(
            { contactId: followup.contact_id, assignToStaffId: userId, followupDate: next.date, followupTime: next.time },
            {
              onSuccess: () => {
                show({ title: 'Follow-up completed', description: 'Next follow-up scheduled.', tone: 'success' })
                onClose()
              },
              // The completion already went through; only the next one failed.
              onError: (err) => {
                show({ title: 'Completed, but the next follow-up was not scheduled', description: err instanceof Error ? err.message : undefined, tone: 'error' })
                onClose()
              },
            },
          )
        },
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Complete follow-up{followup.contact_name ? ` — ${followup.contact_name}` : ''}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className={`space-y-4 ${FOLLOWUP_FORM_TEXT}`}>
        <Field label="What was discussed? *">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} autoFocus />
        </Field>
        {leadUpdate.panel}
        <label className="flex items-center gap-2 text-[14px] font-medium text-[var(--text-h)]">
          <input type="checkbox" checked={addNext} onChange={(e) => setAddNext(e.target.checked)} />
          Schedule the next follow-up with this client
        </label>
        {addNext && (
          <div className="rounded-lg border border-[var(--border)] p-3">
            <FollowupWhenPicker value={when} onChange={setWhen} />
          </div>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={!valid || saving} onClick={submit}>
          {saving ? 'Saving…' : 'Complete follow-up'}
        </Button>
      </Dialog.Footer>
    </>
  )
}

export function RescheduleFollowupDialog({ followup, onClose }: DialogProps) {
  return (
    <Dialog open={Boolean(followup)} onClose={onClose}>
      {followup && <RescheduleForm key={followup.id} followup={followup} onClose={onClose} />}
    </Dialog>
  )
}

function RescheduleForm({ followup, onClose }: { followup: CrmFollowup; onClose: () => void }) {
  const update = useUpdateFollowup()
  const { show } = useToast()
  const [when, setWhen] = useState<When>(initialWhen)

  function submit() {
    if (!whenIsValid(when)) return
    const { date, time } = resolveWhen(when)
    update.mutate(
      { id: followup.id, patch: { date, time } },
      {
        onSuccess: () => {
          show({ title: 'Follow-up rescheduled', tone: 'success' })
          onClose()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not reschedule follow-up', tone: 'error' }),
      },
    )
  }

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Reschedule follow-up{followup.contact_name ? ` — ${followup.contact_name}` : ''}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className={FOLLOWUP_FORM_TEXT}>
        <FollowupWhenPicker value={when} onChange={setWhen} />
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={!whenIsValid(when) || update.isPending} onClick={submit}>
          {update.isPending ? 'Saving…' : 'Reschedule'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
