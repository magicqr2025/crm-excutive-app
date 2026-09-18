import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyCallLogs } from '@/api/queries'

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
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
                <div>
                  <Badge tone={log.outcome === 'connected' ? 'success' : 'error'}>
                    {log.outcome === 'connected' ? 'Connected' : 'Not Connected'}
                  </Badge>
                  {log.remark && <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{log.remark}</p>}
                </div>
                <div className="text-right text-[11.5px] text-[var(--text-muted)]">
                  <p>{new Date(log.created_at).toLocaleString()}</p>
                  {log.duration_seconds !== null && <p>{log.duration_seconds}s</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
