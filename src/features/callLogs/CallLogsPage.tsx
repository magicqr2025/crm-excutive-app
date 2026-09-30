import { PageLoader } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyCallLogsPage } from '@/api/queries'
import { useState } from 'react'
import type { CrmCallLog } from '@/api/crmApi'
import { PlayRecordingButton } from './PlayRecordingButton'
import { format, isToday, isYesterday } from 'date-fns'
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from 'lucide-react'
import { cn, formatTalkTime } from '@/lib/utils'

type CallState = 'connected' | 'not-connected' | 'missed' | 'pending'

// One vocabulary for both kinds of row. A filed disposition says what the
// executive picked; a raw phone record is judged by whether anyone talked.
function callState(log: CrmCallLog): CallState {
  if (log.call_type === 'missed') return 'missed'
  if (log.source !== 'device_sync' && log.outcome) return log.outcome === 'connected' ? 'connected' : 'not-connected'
  if (log.duration_seconds === null) return 'pending'
  return log.duration_seconds > 0 ? 'connected' : 'not-connected'
}

const STATE_STYLE: Record<CallState, { label: string; rail: string; text: string }> = {
  connected: { label: 'Connected', rail: 'bg-[var(--success)]', text: 'text-[var(--success)]' },
  'not-connected': { label: 'Not connected', rail: 'bg-[var(--error)]', text: 'text-[var(--error)]' },
  missed: { label: 'Missed', rail: 'bg-[var(--error)]', text: 'text-[var(--error)]' },
  pending: { label: 'Awaiting call details', rail: 'bg-[var(--border)]', text: 'text-[var(--text-muted)]' },
}

const DIRECTION = {
  outgoing: { label: 'Outgoing', Icon: PhoneOutgoing },
  incoming: { label: 'Incoming', Icon: PhoneIncoming },
  missed: { label: 'Missed', Icon: PhoneMissed },
} as const

function formatWhen(iso: string) {
  const d = new Date(iso)
  const time = format(d, 'h:mm a')
  if (isToday(d)) return `Today, ${time}`
  if (isYesterday(d)) return `Yesterday, ${time}`
  return `${format(d, 'd MMM')}, ${time}`
}

function CallLogRow({ log }: { log: CrmCallLog }) {
  const state = callState(log)
  const style = STATE_STYLE[state]
  const direction = log.call_type ? DIRECTION[log.call_type as keyof typeof DIRECTION] : undefined
  const seconds = state === 'missed' ? null : log.duration_seconds

  return (
    <div className="relative flex items-stretch gap-3 overflow-hidden rounded-xl border border-[var(--border)] py-3 pl-4 pr-3">
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', style.rail)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--text-h)]">{log.contact_name ?? 'Unknown'}</p>
        {log.contact_phone && <p className="font-mono-num text-[12px] text-[var(--text-muted)]">{log.contact_phone}</p>}
        <p className={cn('mt-2 flex items-center gap-1.5 text-[12px] font-medium', style.text)}>
          {direction && <direction.Icon size={13} aria-hidden />}
          <span>{direction && state !== 'missed' ? `${direction.label} · ${style.label}` : style.label}</span>
        </p>
        <p className="mt-0.5 font-mono-num text-[11.5px] text-[var(--text-muted)]">{formatWhen(log.occurred_at)}</p>
        {log.remark && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-[var(--text-muted)]">{log.remark}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <div className="text-right">
          <p className="font-mono-num text-[20px] font-semibold leading-none text-[var(--text-h)]">
            {seconds === null ? '—' : formatTalkTime(seconds)}
          </p>
          <p className="mt-1 text-[10.5px] uppercase tracking-wider text-[var(--text-muted)]">Talk time</p>
        </div>
        <PlayRecordingButton log={log} />
      </div>
    </div>
  )
}

export function CallLogsPage() {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [search, setSearch] = useState('')
  const { items: logs, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMyCallLogsPage(userId, search)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Call Logs" subtitle="Your calls with CRM leads." />
      <div className="space-y-4 p-4">
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
        {search && !isLoading && (
          <p className="text-[12px] text-[var(--text-muted)]">
            {total} {total === 1 ? 'result' : 'results'} for “{search}”
          </p>
        )}
        {isLoading ? (
          <PageLoader />
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No call logs yet.'}</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <CallLogRow key={log.id} log={log} />
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
