import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useCreateCallLog, useLeadFlags, useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import { fetchContactActiveFollowups, updateFollowup, type CallOutcome, type CrmLead } from '@/api/crmApi'
import { cn } from '@/lib/utils'

const NOT_CONNECTED_REASONS = [
  'Did not pick',
  'Busy in another call',
  'User disconnected the call',
  'Switch off',
  'Out of coverage area / Network issue',
  'Other reason',
]
const QUICK_FOLLOWUPS = [
  { label: '1 hour', hours: 1 },
  { label: '6 hour', hours: 6 },
  { label: '1 day', hours: 24 },
]

function formatElapsed(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface DispositionFormProps {
  lead: CrmLead
  onSubmitted: () => void
  /** Set when the call was started from this follow-up's page: this call closes it even if it isn't due yet. */
  followupId?: string
}

// YYYY-MM-DD of a local date (not toISOString, which is the UTC day and wrong late at night in India).
function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Today's IST day, which follow-up dates are stored in.
function istTodayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function DispositionForm({ lead, onSubmitted, followupId }: DispositionFormProps) {
  const queryClient = useQueryClient()
  const { data: leadStatuses = [] } = useLeadStatuses()
  const { data: stageTypes = [] } = useLeadStageTypes()
  const createCallLog = useCreateCallLog()
  const { show } = useToast()

  const [elapsed, setElapsed] = useState(0)
  const [timerStopped, setTimerStopped] = useState(false)
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [reason, setReason] = useState('')
  const [stageTypeId, setStageTypeId] = useState('')
  const [leadStatusId, setLeadStatusId] = useState('')
  const [remark, setRemark] = useState('')
  const [quickHours, setQuickHours] = useState<number | null>(null)
  const [customDateTime, setCustomDateTime] = useState('')
  // One flag per call (or none), from the business's active flags.
  const { data: allFlags = [] } = useLeadFlags()
  const pickableFlags = allFlags.filter((f) => f.active)
  const [flagId, setFlagId] = useState<string | null>(null)
  const [flagNote, setFlagNote] = useState('')

  // Reset the form whenever a new lead is loaded (sequential auto-advance
  // reuses this component across leads rather than remounting it). Flags
  // describe THIS call, not a standing edit of the lead — reset blank every
  // time, same as outcome/reason/remark above, rather than pre-filling from
  // whatever an earlier call already flagged.
  useEffect(() => {
    setElapsed(0)
    setTimerStopped(false)
    setOutcome(null)
    setReason('')
    setStageTypeId('')
    setLeadStatusId('')
    setRemark('')
    setQuickHours(null)
    setCustomDateTime('')
    setFlagId(null)
    setFlagNote('')
  }, [lead.id])

  // Timer runs automatically from when the lead is opened until submit -- no
  // CTI/telephony integration exists, so this is the closest proxy for call
  // duration around the executive's own phone call.
  useEffect(() => {
    if (timerStopped) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [lead.id, timerStopped])

  const anyFlagOn = flagId !== null
  const outcomeValid = outcome === 'connected' ? leadStatusId.length > 0 : outcome === 'not_connected' ? reason.length > 0 : false
  const hasNext = quickHours !== null || customDateTime !== ''
  // A picked date & time can't be in the past (a minute of slack).
  const nextInPast = quickHours === null && customDateTime !== '' && new Date(customDateTime).getTime() < Date.now() - 60_000
  // Not connected: the client must be tried again, so a next follow-up is required.
  const nextRequired = outcome === 'not_connected'
  const valid = outcomeValid && (!anyFlagOn || flagNote.trim().length > 0) && !nextInPast && (!nextRequired || hasNext)

  // The call result, written as the note on the follow-up(s) this call closes.
  function callNote(): string {
    const status = leadStatuses.find((s) => s.id === leadStatusId)?.lead_status
    const head = outcome === 'connected' ? `Connected${status ? ` — ${status}` : ''}` : `Not connected — ${reason}`
    return (remark.trim() ? `${head}: ${remark.trim()}` : head).slice(0, 2000)
  }

  // Flags are mutually exclusive — checking one clears the others;
  // unchecking the active one leaves none selected.
  function selectFlag(id: string, checked: boolean) {
    setFlagId(checked ? id : null)
  }

  async function submit() {
    if (!outcome || !valid) return
    setTimerStopped(true)
    let followupDate: string | undefined
    let followupTime: string | undefined
    if (quickHours !== null) {
      const target = new Date(Date.now() + quickHours * 60 * 60 * 1000)
      followupDate = localYmd(target)
      followupTime = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}:00`
    } else if (customDateTime) {
      const target = new Date(customDateTime)
      followupDate = customDateTime.slice(0, 10)
      followupTime = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}:00`
    }

    // The open follow-ups this call answers: the one it was started from, plus any of this lead's that are
    // due today or overdue. Read before saving, so the next follow-up this call books isn't closed too.
    let toClose: string[] = followupId ? [followupId] : []
    try {
      const today = istTodayYmd()
      const open = await fetchContactActiveFollowups(lead.contact_id)
      toClose = [...new Set([...toClose, ...open.filter((f) => f.followup_date.slice(0, 10) <= today).map((f) => f.id)])]
    } catch {
      // Couldn't look them up; still save the call and close the one it was started from.
    }

    createCallLog.mutate(
      {
        leadId: lead.id,
        outcome,
        ...(outcome === 'not_connected' ? { reason } : {}),
        ...(outcome === 'connected' ? { leadStatusId } : {}),
        ...(remark.trim() ? { remark: remark.trim() } : {}),
        ...(followupDate ? { followupDate } : {}),
        ...(followupTime ? { followupTime } : {}),
        flagId,
        flagNote: flagNote.trim(),
      },
      {
        onSuccess: async () => {
          const note = callNote()
          const results = await Promise.allSettled(toClose.map((id) => updateFollowup(id, { status: '2', note })))
          const failed = results.some((r) => r.status === 'rejected')
          // The call may also have booked the next follow-up.
          queryClient.invalidateQueries({ queryKey: ['my-followups'] })
          queryClient.invalidateQueries({ queryKey: ['lead-activity'] })
          if (failed) {
            show({ title: 'Call saved, but the follow-up was not closed', description: 'Complete it from the Follow-ups page.', tone: 'error' })
          } else {
            show({ title: 'Call outcome saved', description: toClose.length > 0 ? 'Follow-up completed.' : undefined, tone: 'success' })
          }
          onSubmitted()
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to save call outcome', tone: 'error' }),
      },
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] p-5">
      <div>
        <p className="text-[15px] font-semibold text-[var(--text-h)]">Call Status</p>
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse motion-reduce:animate-none" />
          <span className="font-mono-num text-[13px] font-semibold text-[var(--accent-strong)]">{formatElapsed(elapsed)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setOutcome('not_connected')}
          className={cn(
            'rounded-xl border py-3 text-[13px] font-semibold',
            outcome === 'not_connected'
              ? 'border-[var(--error)] bg-[var(--error-bg)] text-[var(--error)]'
              : 'border-[var(--border)] text-[var(--error)] hover:bg-[var(--error-bg)]',
          )}
        >
          Not Connected
        </button>
        <button
          type="button"
          onClick={() => setOutcome('connected')}
          className={cn(
            'rounded-xl border py-3 text-[13px] font-semibold',
            outcome === 'connected'
              ? 'border-[var(--success)] bg-[var(--success-bg)] text-[var(--success)]'
              : 'border-[var(--border)] text-[var(--success)] hover:bg-[var(--success-bg)]',
          )}
        >
          Yes Connected
        </button>
      </div>

      {outcome === 'not_connected' && (
        <div className="rounded-xl border border-[var(--border)] p-3.5">
          <p className="mb-2 text-[13px] font-semibold text-[var(--text-h)]">Please specify the reason? *</p>
          <div className="space-y-1.5">
            {NOT_CONNECTED_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-[13px] text-[var(--text)]">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--accent)]" />
                {r}
              </label>
            ))}
          </div>
        </div>
      )}

      {outcome === 'connected' && (
        <div className="rounded-xl border border-[var(--border)] p-3.5 space-y-3">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-[var(--text-h)]">Stage *</p>
            <select
              value={stageTypeId}
              onChange={(e) => setStageTypeId(e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]"
            >
              <option value="">Select stage</option>
              {stageTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lead_stage}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-[var(--text-h)]">Status *</p>
            <div className="space-y-1.5">
              {leadStatuses
                .filter((s) => s.stage_id === stageTypeId)
                .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
                .map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-[13px] text-[var(--text)]">
                    <input
                      type="radio"
                      name="status"
                      checked={leadStatusId === s.id}
                      onChange={() => setLeadStatusId(s.id)}
                      className="accent-[var(--accent)]"
                    />
                    {s.lead_status}
                  </label>
                ))}
              {stageTypeId && leadStatuses.filter((s) => s.stage_id === stageTypeId).length === 0 && (
                <p className="text-[12.5px] text-[var(--text-muted)]">No statuses configured for this stage yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {outcome && (
        <div className="rounded-xl border border-[var(--border)] p-3.5 space-y-3">
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Select next action{nextRequired ? ' *' : ''}</p>
          {nextRequired && !hasNext && <p className="text-[12px] text-[var(--text-muted)]">Not connected — pick when to try again.</p>}
          <div className="flex flex-wrap gap-2">
            {QUICK_FOLLOWUPS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setQuickHours((c) => (c === opt.hours ? null : opt.hours))
                  setCustomDateTime('')
                }}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-medium',
                  quickHours === opt.hours
                    ? 'border-[var(--accent)] text-[var(--accent-strong)]'
                    : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)]',
                )}
              >
                {opt.label}
                {quickHours === opt.hours && <X size={12} />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setQuickHours(null)}
              className="flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              <Calendar size={12} /> Pick date &amp; time
            </button>
          </div>
          <Input
            type="datetime-local"
            value={customDateTime}
            onChange={(e) => {
              setCustomDateTime(e.target.value)
              setQuickHours(null)
            }}
          />
          {nextInPast && <p className="text-[12px] text-[var(--error)]">Next follow-up can’t be earlier than now.</p>}
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-[var(--text-h)]">Dispose Remark</p>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value.slice(0, 1500))}
              placeholder="Type here…"
              maxLength={1500}
              className="min-h-[80px] w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-h)]"
            />
          </div>
        </div>
      )}

      {outcome && (
        <div className="rounded-xl border border-[var(--border)] p-3.5 space-y-3">
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Flags</p>
          <div className="space-y-2">
            {pickableFlags.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-[13px] text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={flagId === f.id}
                  onChange={(e) => selectFlag(f.id, e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
                {f.name}
              </label>
            ))}
          </div>
          {anyFlagOn && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-[var(--text-h)]">What is the lead saying? *</p>
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value.slice(0, 2000))}
                placeholder="Type here…"
                maxLength={2000}
                className="min-h-[70px] w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-h)]"
              />
              <p className="mt-1 text-right text-[11px] text-[var(--text-muted)]">{flagNote.length}/2000</p>
            </div>
          )}
        </div>
      )}

      <Button className="w-full justify-center" onClick={submit} disabled={!valid || createCallLog.isPending}>
        {createCallLog.isPending ? 'Submitting…' : 'Submit'}
      </Button>
    </div>
  )
}
