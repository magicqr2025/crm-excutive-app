import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
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
    </div>
  )
}
