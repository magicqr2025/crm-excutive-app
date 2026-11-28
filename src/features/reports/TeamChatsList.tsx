import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { waitingFor } from '@/features/performance/performanceUtils'
import { useTeamChats } from './reportQueries'
import { QueryState } from './reportParts'

/** Leads the team is talking to in the WhatsApp inbox right now. A chat leaves the list when it is marked Resolved. */
export function TeamChatsList() {
  const query = useTeamChats(true)
  const chats = query.data?.chats ?? []
  return (
    <QueryState query={query} empty={chats.length === 0 ? 'No open WhatsApp chats.' : null}>
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
        {chats.map((chat) => {
          const waiting = chat.last_from === 'customer'
          return (
            <li key={chat.conversation_id}>
              <Link to={`/contacts/${chat.lead_ref}`} className="flex items-start gap-3 px-3.5 py-3 hover:bg-[var(--surface-hover)]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[var(--text-h)]">{chat.lead_name}</span>
                  <span className="block truncate text-[12.5px] text-[var(--text-muted)]">{chat.last_message}</span>
                  <span className="block truncate text-[11.5px] text-[var(--accent-strong)]">{chat.staff_name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn('block text-[12px] font-medium', waiting ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]')}>
                    {waiting ? `Waiting ${waitingFor(chat.last_message_at)}` : 'We replied last'}
                  </span>
                  <span className="block font-mono-num text-[11px] text-[var(--text-muted)]">{chat.phone}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {query.data?.truncated && <p className="mt-2 text-[12px] text-[var(--text-muted)]">Showing the {chats.length} most recent chats.</p>}
    </QueryState>
  )
}
