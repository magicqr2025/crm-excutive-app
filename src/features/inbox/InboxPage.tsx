import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { cn } from '@/lib/utils'
import { formatListTime } from './inboxFormat'
import { useConversations } from './useInbox'

export function InboxPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: conversations = [], isLoading, isError } = useConversations(search || undefined)

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col">
      <div className="shrink-0 space-y-3 p-4 pb-2">
        <h1 className="font-display text-[17px] font-semibold text-[var(--text-h)]">Inbox</h1>
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">Couldn't load your chats. Pull down to try again.</p>
        ) : conversations.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search
              ? `No chats match “${search}”.`
              : 'No chats yet. Open one of your leads and tap Company WhatsApp to start a chat.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/inbox/${c.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)]"
                >
                  <Avatar name={c.contactName} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{c.contactName}</p>
                      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatListTime(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('truncate text-[12.5px]', c.unreadCount > 0 ? 'font-medium text-[var(--text-h)]' : 'text-[var(--text-muted)]')}>
                        {c.lastMessage
                          ? `${c.lastMessage.direction === 'out' ? 'You: ' : ''}${c.lastMessage.body ?? 'Attachment'}`
                          : 'No messages yet'}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-[var(--success)] px-1.5 text-[11px] font-semibold leading-4 text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
