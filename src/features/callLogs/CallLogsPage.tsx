import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyCallLogs, useDeviceCallLogs } from '@/api/queries'
import type { CrmDeviceCallLog } from '@/api/crmApi'
import { RecordingFolder, type RecordingMatch } from '@/lib/nativeRecordingFolder'
import { Play, Square } from 'lucide-react'

function DeviceCallRow({ log }: { log: CrmDeviceCallLog }) {
  const [match, setMatch] = useState<RecordingMatch | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
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
  }, [log.phone_number, log.call_time, log.duration_seconds])

  useEffect(() => {
    const sub = RecordingFolder.addListener('playbackEnded', () => setPlaying(false))
    return () => {
      sub.then((handle) => handle.remove())
    }
  }, [])

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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Avatar name={log.contact_name ?? 'Unknown'} size={30} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{log.contact_name ?? 'Unknown'}</p>
          <p className="font-mono-num text-[11.5px] text-[var(--text-muted)]">{log.phone_number}</p>
          <div className="mt-1.5">
            <Badge tone={log.call_type === 'missed' ? 'error' : 'success'}>{log.call_type}</Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right font-mono-num text-[11.5px] text-[var(--text-muted)]">
          <p>{new Date(log.call_time).toLocaleString()}</p>
          {log.duration_seconds !== null && <p>{log.duration_seconds}s</p>}
        </div>
        {match && (
          <button
            type="button"
            onClick={togglePlay}
            title={playing ? 'Stop' : 'Play recording'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--accent-strong)]"
          >
            {playing ? <Square size={14} /> : <Play size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

export function CallLogsPage() {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: logs = [], isLoading } = useMyCallLogs(userId)
  const { data: deviceLogs = [] } = useDeviceCallLogs(userId)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Call Logs" subtitle="Your call history." />
      <div className="space-y-6 p-4">
        <div>
          {isLoading ? (
            <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No call logs yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Avatar name={log.contact_name ?? 'Unknown'} size={30} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{log.contact_name ?? 'Unknown'}</p>
                      {log.contact_phone && <p className="font-mono-num text-[11.5px] text-[var(--text-muted)]">{log.contact_phone}</p>}
                      <div className="mt-1.5">
                        <Badge tone={log.outcome === 'connected' ? 'success' : 'error'}>
                          {log.outcome === 'connected' ? 'Connected' : 'Not Connected'}
                        </Badge>
                      </div>
                      {log.remark && <p className="mt-1 truncate text-[12.5px] text-[var(--text-muted)]">{log.remark}</p>}
                    </div>
                  </div>
                  <div className="text-right font-mono-num text-[11.5px] text-[var(--text-muted)]">
                    <p>{new Date(log.created_at).toLocaleString()}</p>
                    {log.duration_seconds !== null && <p>{log.duration_seconds}s</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {deviceLogs.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Device Call History
            </p>
            <div className="space-y-2">
              {deviceLogs.map((log) => (
                <DeviceCallRow key={log.id} log={log} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
