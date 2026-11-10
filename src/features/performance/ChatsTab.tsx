import { Link } from 'react-router-dom'
import { Clock, MessageCircle } from 'lucide-react'
import { PageLoader } from '@/components/ui/Spinner'
import { useMyOpenChats } from '@/api/queries'
import { cn } from '@/lib/utils'
import { Kpi } from './PerformanceParts'
import { waitingFor } from './performanceUtils'

/** Leads in an open WhatsApp inbox chat right now; a chat leaves the list when it is marked Resolved. */
export function ChatsTab() {
  const { data, isLoading, isError, error } = useMyOpenChats()

  if (isLoading) return <PageLoader />
  if (isError) return <p className="py-8 text-center text-[13px] text-[var(--error)]">{error instanceof Error ? error.message : "Couldn't load your chats."}</p>
  if (!data || data.chats.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-[var(--text-muted)]">
        <MessageCircle size={22} />
        <p className="text-[13px]">No open WhatsApp chats. Leads appear here while their inbox chat is open.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:max-w-md">
        <Kpi icon={MessageCircle} label="Open chats" value={data.total.toLocaleString()} sub="leads talking on WhatsApp" />
        <Kpi
          icon={Clock}
          label="Waiting on us"
          value={data.waiting_on_us.toLocaleString()}
          sub="customer wrote last"
          tone={data.waiting_on_us > 0 ? 'warning' : undefined}
        />
      </div>
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {data.chats.map((c) => {
          const waiting = c.last_from === 'customer'
          return (
            <li key={c.conversation_id}>
              <Link to={`/contacts/${c.lead_ref}`} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-hover)]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{c.lead_name}</p>
                  <p className="truncate text-[12.5px] text-[var(--text-muted)]">{c.last_message}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('text-[12px] font-medium', waiting ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]')}>
                    {waiting ? `Waiting ${waitingFor(c.last_message_at)}` : 'We replied last'}
                  </p>
                  <p className="text-[11px] tabular-nums text-[var(--text-muted)]">{c.phone}</p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {data.truncated && <p className="text-[12px] text-[var(--text-muted)]">Showing the {data.chats.length} most recent chats.</p>}
    </div>
  )
}
