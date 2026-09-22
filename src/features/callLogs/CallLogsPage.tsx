import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyCallLogs } from '@/api/queries'
import type { CrmCallLog } from '@/api/crmApi'
import { RecordingFolder, type RecordingMatch } from '@/lib/nativeRecordingFolder'
import { Play, Square } from 'lucide-react'

function OutcomeBadge({ log }: { log: CrmCallLog }) {
  if (log.source === 'device_sync') {
    return <Badge tone={log.call_type === 'missed' ? 'error' : 'success'}>{log.call_type}</Badge>
  }
  return (
    <Badge tone={log.outcome === 'connected' ? 'success' : 'error'}>
      {log.outcome === 'connected' ? 'Connected' : 'Not Connected'}
    </Badge>
  )
}

function PlayRecordingButton({ log }: { log: CrmCallLog }) {
  const [match, setMatch] = useState<RecordingMatch | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (log.source !== 'device_sync' || !log.phone_number || !log.call_time) return
    let cancelled = false
    RecordingFolder.findRecording({
      number: log.phone_number,
      callTimeMs: new Date(log.call_time).getTime(),
      durationSeconds: log.duration_seconds ?? 0,
    }).then((result) => {
      if (!cancelled) setMatch(result.match)
    })
    return () => {
      cancelled = true
    }
  }, [log.source, log.phone_number, log.call_time, log.duration_seconds])

  useEffect(() => {
    const sub = RecordingFolder.addListener('playbackEnded', () => setPlaying(false))
    return () => {
      sub.then((handle) => handle.remove())
    }
  }, [])

  if (!match) return null

  async function togglePlay() {
    if (!match) return
    if (playing) {
      await RecordingFolder.stop()
      setPlaying(false)
    } else {
      await RecordingFolder.play({ uri: match.uri })
      setPlaying(true)
    }
  }

  return (
    <button
      type="button"
      onClick={togglePlay}
      title={playing ? 'Stop' : 'Play recording'}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--accent-strong)]"
    >
      {playing ? <Square size={14} /> : <Play size={14} />}
    </button>
  )
}

function CallLogRow({ log }: { log: CrmCallLog }) {
  const timestamp = log.call_time ?? log.created_at
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Avatar name={log.contact_name ?? 'Unknown'} size={30} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{log.contact_name ?? 'Unknown'}</p>
          {log.contact_phone && <p className="font-mono-num text-[11.5px] text-[var(--text-muted)]">{log.contact_phone}</p>}
          <div className="mt-1.5">
            <OutcomeBadge log={log} />
          </div>
          {log.remark && <p className="mt-1 truncate text-[12.5px] text-[var(--text-muted)]">{log.remark}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right font-mono-num text-[11.5px] text-[var(--text-muted)]">
          <p>{new Date(timestamp).toLocaleString()}</p>
          {log.duration_seconds !== null && <p>{log.duration_seconds}s</p>}
        </div>
        <PlayRecordingButton log={log} />
      </div>
    </div>
  )
}

export function CallLogsPage() {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: logs = [], isLoading } = useMyCallLogs(userId)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Call Logs" subtitle="Your call history." />
      <div className="p-4">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No call logs yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <CallLogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
