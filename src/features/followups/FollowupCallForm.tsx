import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useCreateCallLog } from '@/api/queries'
import { updateFollowup, type CallOutcome, type CrmLead } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { FollowupWhenPicker, initialWhen, resolveWhen, whenIsValid, type When } from './FollowupWhenPicker'

// The short form after calling from a follow-up's own page: did they pick up, the reason or what was
// discussed, and when to follow up next. Submitting logs the call (so call logs and performance count it),
// marks this follow-up done with that note, and books the next one. The full Call Status form (stage,
// status, flags) stays for Pipeline / Contacts calls.

const NOT_CONNECTED_REASONS = ['Did not pick', 'Busy', 'Switched off', 'Network issue', 'Other']

function formatElapsed(totalSeconds: number) {
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

interface FollowupCallFormProps {
  lead: CrmLead
  followupId: string
  contactName: string | null
  onSubmitted: () => void
}

export function FollowupCallForm({ lead, followupId, contactName, onSubmitted }: FollowupCallFormProps) {
  const queryClient = useQueryClient()
  const createCallLog = useCreateCallLog()
  const { show } = useToast()
  const [elapsed, setElapsed] = useState(0)
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [reason, setReason] = useState('')
  const [discussed, setDiscussed] = useState('')
  const [addNext, setAddNext] = useState(false)
  const [when, setWhen] = useState<When>(initialWhen)
  const [saving, setSaving] = useState(false)

  // Counts from when the form opens (right after dialling) until submit.
  useEffect(() => {
    if (saving) return
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [saving])

  // Not connected: a reason and a time to try again are both required.
  // Connected: what was discussed is required; the next follow-up is optional.
  const wantsNext = outcome === 'not_connected' || addNext
  const valid =
    outcome === 'not_connected'
      ? reason !== '' && whenIsValid(when)
      : outcome === 'connected'
        ? discussed.trim() !== '' && (!addNext || whenIsValid(when))
        : false

  function submit() {
    if (!outcome || !valid) return
    setSaving(true)
    const next = wantsNext ? resolveWhen(when) : null
    const note = (outcome === 'connected' ? `Connected: ${discussed.trim()}` : `Not connected — ${reason}`).slice(0, 2000)
    createCallLog.mutate(
      {
        leadId: lead.id,
        outcome,
        ...(outcome === 'not_connected' ? { reason } : { remark: discussed.trim() }),
        durationSeconds: elapsed,
        // The server books the next follow-up from these.
        ...(next ? { followupDate: next.date, followupTime: `${next.time}:00` } : {}),
      },
      {
        onSuccess: async () => {
          try {
            await updateFollowup(followupId, { status: '2', note })
            show({ title: 'Follow-up completed', description: next ? 'Next follow-up scheduled.' : undefined, tone: 'success' })
          } catch {
            show({ title: 'Call saved, but the follow-up was not closed', description: 'Complete it from the Follow-ups page.', tone: 'error' })
          }
          queryClient.invalidateQueries({ queryKey: ['my-followups'] })
          queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
          setSaving(false)
          onSubmitted()
        },
        onError: (err) => {
          setSaving(false)
          show({ title: err instanceof Error ? err.message : 'Could not save the call', tone: 'error' })
        },
      },
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] p-5">
      <div>
        <p className="pr-8 text-[15px] font-semibold text-[var(--text-h)]">Follow-up call{contactName ? ` — ${contactName}` : ''}</p>
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
          <span className="font-mono-num text-[13px] font-semibold text-[var(--accent-strong)]">{formatElapsed(elapsed)}</span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-[var(--text-h)]">Did they pick up?</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setOutcome('not_connected')}
            className={cn(
              'rounded-xl border py-3 text-[13px] font-semibold',
              outcome === 'not_connected' ? 'border-[var(--error)] bg-[var(--error-bg)] text-[var(--error)]' : 'border-[var(--border)] text-[var(--error)] hover:bg-[var(--error-bg)]',
            )}
          >
            Not Connected
          </button>
          <button
            type="button"
            onClick={() => setOutcome('connected')}
            className={cn(
              'rounded-xl border py-3 text-[13px] font-semibold',
              outcome === 'connected' ? 'border-[var(--success)] bg-[var(--success-bg)] text-[var(--success)]' : 'border-[var(--border)] text-[var(--success)] hover:bg-[var(--success-bg)]',
            )}
          >
            Yes Connected
          </button>
        </div>
      </div>

      {outcome === 'not_connected' && (
        <>
          <Field label="Reason *">
            <div className="flex flex-wrap gap-1.5">
              {NOT_CONNECTED_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                    reason === r ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)]',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </Field>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="mb-2 text-[12px] font-medium text-[var(--text-muted)]">Call again *</p>
            <FollowupWhenPicker value={when} onChange={setWhen} />
          </div>
        </>
      )}

      {outcome === 'connected' && (
        <>
          <Field label="What was discussed? *">
            <Textarea value={discussed} onChange={(e) => setDiscussed(e.target.value.slice(0, 1500))} rows={4} />
          </Field>
          <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-h)]">
            <input type="checkbox" checked={addNext} onChange={(e) => setAddNext(e.target.checked)} className="accent-[var(--accent)]" />
            Schedule the next follow-up with this client
          </label>
          {addNext && (
            <div className="rounded-lg border border-[var(--border)] p-3">
              <FollowupWhenPicker value={when} onChange={setWhen} />
            </div>
          )}
        </>
      )}

      <Button className="w-full justify-center" onClick={submit} disabled={!valid || saving}>
        {saving ? 'Saving…' : 'Complete follow-up'}
      </Button>
    </div>
  )
}
