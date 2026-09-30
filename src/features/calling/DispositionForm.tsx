import { useEffect, useState } from 'react'
import { Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useCreateCallLog, useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import { CALL_STATUS_FLAG_LABELS, type CallOutcome, type CallStatusFlagKey, type CrmLead } from '@/api/crmApi'
import { cn } from '@/lib/utils'

const CALL_STATUS_FLAG_KEYS: CallStatusFlagKey[] = ['need_attention', 'feature_requirement', 'special_meeting', 'premium_client']

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
}

export function DispositionForm({ lead, onSubmitted }: DispositionFormProps) {
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
  const [flags, setFlags] = useState<Record<CallStatusFlagKey, boolean>>({
    need_attention: false,
    feature_requirement: false,
    special_meeting: false,
    premium_client: false,
  })
  const [flagNote, setFlagNote] = useState('')

  // Reset the form whenever a new lead is loaded (sequential auto-advance
  // reuses this component across leads rather than remounting it). Flags are
  // sticky on the lead (not reset to false) — they seed from whatever an
  // earlier call already flagged, same as orm-whatsapp's CallDispositionDialog.
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
    setFlags({
      need_attention: lead.need_attention,
      feature_requirement: lead.feature_requirement,
      special_meeting: lead.special_meeting,
      premium_client: lead.premium_client,
    })
    setFlagNote(lead.flag_note ?? '')
  }, [lead.id])

  // Timer runs automatically from when the lead is opened until submit -- no
  // CTI/telephony integration exists, so this is the closest proxy for call
  // duration around the executive's own phone call.
  useEffect(() => {
    if (timerStopped) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [lead.id, timerStopped])

  const anyFlagOn = CALL_STATUS_FLAG_KEYS.some((key) => flags[key])
  const outcomeValid = outcome === 'connected' ? leadStatusId.length > 0 : outcome === 'not_connected' ? reason.length > 0 : false
  const valid = outcomeValid && (!anyFlagOn || flagNote.trim().length > 0)

  // Flags are mutually exclusive — checking one clears the other three;
  // unchecking the active one leaves none selected.
  function selectFlag(key: CallStatusFlagKey, checked: boolean) {
    setFlags({
      need_attention: false,
      feature_requirement: false,
      special_meeting: false,
      premium_client: false,
      [key]: checked,
    })
  }

  function submit() {
    if (!outcome || !valid) return
    setTimerStopped(true)
    let followupDate: string | undefined
    let followupTime: string | undefined
    if (quickHours !== null) {
      const target = new Date(Date.now() + quickHours * 60 * 60 * 1000)
      followupDate = target.toISOString().slice(0, 10)
      followupTime = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}:00`
    } else if (customDateTime) {
      const target = new Date(customDateTime)
      followupDate = customDateTime.slice(0, 10)
      followupTime = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}:00`
    }

    createCallLog.mutate(
      {
        leadId: lead.id,
        outcome,
        ...(outcome === 'not_connected' ? { reason } : {}),
        ...(outcome === 'connected' ? { leadStatusId } : {}),
        ...(remark.trim() ? { remark: remark.trim() } : {}),
        durationSeconds: elapsed,
        ...(followupDate ? { followupDate } : {}),
        ...(followupTime ? { followupTime } : {}),
        needAttention: flags.need_attention,
        featureRequirement: flags.feature_requirement,
        specialMeeting: flags.special_meeting,
        premiumClient: flags.premium_client,
        flagNote: flagNote.trim(),
      },
      {
        onSuccess: () => {
          show({ title: 'Call outcome saved', tone: 'success' })
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
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Select next action</p>
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
            {CALL_STATUS_FLAG_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-[13px] text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={flags[key]}
                  onChange={(e) => selectFlag(key, e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                {CALL_STATUS_FLAG_LABELS[key]}
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
