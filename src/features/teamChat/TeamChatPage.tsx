import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, Plus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'
import { formatListTime } from '@/features/inbox/inboxFormat'
import type { ChatChannel } from '@/api/chatApi'
import { useChatChannels, useChatMe, useChatPeople, useOpenDirect } from './useTeamChat'
import { messageSummary, speakerPrefix } from './chatPreview'

function ChannelRow({ channel, meId, onOpen }: { channel: ChatChannel; meId: string; onOpen: () => void }) {
  const last = channel.last_message
  const prefix = last ? speakerPrefix(last, meId, channel.is_direct) : null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)]"
    >
      {channel.is_direct ? (
        <Avatar name={channel.name} size={40} />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)]">
          <Hash size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13.5px] font-semibold text-[var(--text-h)]">{channel.name}</p>
          {channel.last_message_at && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatListTime(channel.last_message_at)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn('truncate text-[12.5px]', channel.unread_count > 0 ? 'font-medium text-[var(--text-h)]' : 'text-[var(--text-muted)]')}>
            {last ? `${prefix ? `${prefix}: ` : ''}${messageSummary(last)}` : 'No messages yet'}
          </p>
          {channel.unread_count > 0 && (
            <span className="shrink-0 rounded-full bg-[var(--success)] px-1.5 text-[11px] font-semibold leading-4 text-white">{channel.unread_count}</span>
          )}
        </div>
      </div>
    </button>
  )
}

export function TeamChatPage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [search, setSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: me } = useChatMe()
  const { data: channels = [], isLoading, isError, error } = useChatChannels()
  const { data: people = [], isLoading: loadingPeople } = useChatPeople(pickerOpen)
  const openDirect = useOpenDirect()

  const term = search.trim().toLowerCase()
  const visible = channels.filter((c) => !c.is_archived && (!term || c.name.toLowerCase().includes(term)))
  const groups = visible.filter((c) => !c.is_direct)
  const directs = visible.filter((c) => c.is_direct)
  const meId = me?.id ?? ''

  function startDirect(staffId: string) {
    openDirect.mutate(staffId, {
      onSuccess: (channel) => {
        setPickerOpen(false)
        navigate(`/team-chat/${channel.id}`)
      },
      onError: (err) => show({ title: err instanceof Error ? err.message : "Couldn't open the chat", tone: 'error' }),
    })
  }

  const section = (title: string, list: ChatChannel[]) =>
    list.length > 0 && (
      <div className="space-y-2">
        <p className="px-1 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</p>
        {list.map((c) => (
          <ChannelRow key={c.id} channel={c} meId={meId} onOpen={() => navigate(`/team-chat/${c.id}`)} />
        ))}
      </div>
    )

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col">
      <div className="shrink-0 space-y-3 p-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[17px] font-semibold text-[var(--text-h)]">Team Chat</h1>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[12.5px] font-medium text-[var(--ink)]"
          >
            {pickerOpen ? <X size={14} /> : <Plus size={14} />}
            {pickerOpen ? 'Close' : 'New chat'}
          </button>
        </div>
        {pickerOpen ? (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
            {loadingPeople ? (
              <PageLoader />
            ) : people.length === 0 ? (
              <p className="p-3 text-center text-[13px] text-[var(--text-muted)]">No colleagues to chat with.</p>
            ) : (
              people.map((p) => (
                <button
                  key={p.staff_id}
                  type="button"
                  disabled={openDirect.isPending}
                  onClick={() => startDirect(p.staff_id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <Avatar name={p.name} size={30} />
                  <span className="truncate text-[13px] text-[var(--text-h)]">{p.name}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <SearchBox value={search} onSubmit={setSearch} placeholder="Search chats…" />
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">{error instanceof Error ? error.message : "Couldn't load chats."}</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search ? `No chats match “${search}”.` : 'No chats yet. Tap New chat to message a colleague.'}
          </p>
        ) : (
          <>
            {section('Channels', groups)}
            {section('Direct messages', directs)}
          </>
        )}
      </div>
    </div>
  )
}
