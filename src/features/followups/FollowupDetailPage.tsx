import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyActiveFollowups, useCallLogsForLead } from '@/api/queries'
import { STATUS_LABEL, STATUS_TONE, formatDate, formatTime } from './FollowupsPage'

export function FollowupDetailPage() {
  const { followupId = '' } = useParams<{ followupId: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: followups = [], isLoading: isLoadingFollowups } = useMyActiveFollowups(userId)
  const followup = followups.find((f) => f.id === followupId)
  const { data: callLogs = [], isLoading: isLoadingLogs } = useCallLogsForLead(followup?.lead_id)

  if (isLoadingFollowups) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">Loading…</div>
  }

  if (!followup) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-[var(--text-muted)]">Follow-up not found.</p>
        <button onClick={() => navigate('/followups')} className="text-[13px] text-[var(--accent)]">
          Back to follow-ups
        </button>
      </div>
    )
  }

  const [lastCall, ...earlierCalls] = callLogs

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <button
          onClick={() => navigate('/followups')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={17} />
        </button>
        <p className="text-[13.5px] font-semibold text-[var(--text-h)]">Follow-up Details</p>
      </div>

      <div className="mx-auto w-full max-w-lg space-y-4 p-4">
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <Avatar name={followup.contact_name ?? 'Unknown'} size={40} />
            <div>
              <p className="text-[15px] font-semibold text-[var(--text-h)]">{followup.contact_name ?? 'Unknown'}</p>
              <p className="text-[13px] text-[var(--text-muted)]">{followup.contact_phone ?? '—'}</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-[var(--text)]">
            Due {formatDate(followup.followup_date)} · {formatTime(followup.followup_time)}
          </p>
          <div className="mt-2">
            <Badge tone={STATUS_TONE[followup.followup_status]}>{STATUS_LABEL[followup.followup_status]}</Badge>
          </div>
          {followup.contact_phone && (
            <a
              href={`tel:${followup.contact_phone}`}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--accent-strong)]"
            >
              <Phone size={14} /> Call {followup.contact_phone}
            </a>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] p-4">
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Last Discussion</p>
          {isLoadingLogs ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : !lastCall ? (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">No previous calls logged for this lead yet.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge tone={lastCall.outcome === 'connected' ? 'success' : 'error'}>
                  {lastCall.outcome === 'connected' ? 'Connected' : 'Not Connected'}
                </Badge>
                <span className="text-[11.5px] text-[var(--text-muted)]">{new Date(lastCall.created_at).toLocaleString()}</span>
              </div>
              {lastCall.reason && <p className="text-[12.5px] text-[var(--text-muted)]">Reason: {lastCall.reason}</p>}
              {lastCall.remark ? (
                <p className="text-[13px] text-[var(--text)]">{lastCall.remark}</p>
              ) : (
                <p className="text-[13px] italic text-[var(--text-muted)]">No remark left.</p>
              )}
              {lastCall.duration_seconds !== null && (
                <p className="text-[11.5px] text-[var(--text-muted)]">Duration: {lastCall.duration_seconds}s</p>
              )}
            </div>
          )}
        </div>

        {earlierCalls.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="text-[13px] font-semibold text-[var(--text-h)]">Earlier Calls</p>
            <div className="mt-2 space-y-2">
              {earlierCalls.map((log) => (
                <div key={log.id} className="rounded-lg border border-[var(--border)] p-2.5">
                  <div className="flex items-center justify-between">
                    <Badge tone={log.outcome === 'connected' ? 'success' : 'error'}>
                      {log.outcome === 'connected' ? 'Connected' : 'Not Connected'}
                    </Badge>
                    <span className="text-[11px] text-[var(--text-muted)]">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  {log.remark && <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{log.remark}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
