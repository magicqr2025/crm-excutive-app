import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Ban, Check, CheckCheck, CornerDownLeft, Inbox as InboxIcon, Megaphone } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'
import { useCampaignLeadsPage, useMyLeadCampaigns, useStaffList } from '@/api/queries'
import type { CrmLead } from '@/api/crmApi'
import type { Conversation } from '@/api/inboxApi'
import { formatListTime } from './inboxFormat'
import { useConversations, useStartConversation } from './useInbox'

type Filter = 'all' | 'unread' | 'awaiting'
type PanelTab = 'inbox' | 'pipeline'

const PANEL_TABS: { value: PanelTab; label: string; icon: typeof InboxIcon }[] = [
  { value: 'inbox', label: 'Inbox', icon: InboxIcon },
  { value: 'pipeline', label: 'Pipeline', icon: Megaphone },
]

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'awaiting', label: 'Awaiting reply' },
]

// Remembers the last pipeline between visits.
const PIPELINE_KEY = 'exec_inbox_pipeline'
const TAB_KEY = 'exec_inbox_tab'

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — the choice just isn't remembered.
  }
}

// The customer wrote last and nobody has answered yet.
const isAwaiting = (c: Conversation) => c.lastMessage?.direction === 'in'
const byLatest = (a: Conversation, b: Conversation) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()

function DeliveryTick({ status }: { status: NonNullable<Conversation['lastMessage']>['status'] }) {
  if (status === 'failed') return <AlertCircle size={13} className="shrink-0 text-[var(--error)]" />
  if (status === 'read') return <CheckCheck size={13} className="shrink-0 text-[var(--info)]" />
  if (status === 'delivered') return <CheckCheck size={13} className="shrink-0" />
  return <Check size={13} className="shrink-0" />
}

function ConversationRow({ conversation: c, agentName, onOpen }: { conversation: Conversation; agentName?: string; onOpen: () => void }) {
  const last = c.lastMessage
  const awaiting = isAwaiting(c)
  const tags = c.tags ?? []
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 border-b border-[var(--border)] px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]"
    >
      <Avatar name={c.contactName} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] font-medium text-[var(--text-h)]">{c.contactName}</span>
          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatListTime(c.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          {/* Who spoke last: "You:" + delivery ticks for ours, bold when it is the customer's turn. */}
          <p className={cn('flex min-w-0 items-center gap-1 text-[12.5px]', awaiting ? 'font-medium text-[var(--text-h)]' : 'text-[var(--text-muted)]')}>
            {last?.direction === 'out' && (
              <>
                <DeliveryTick status={last.status} />
                <span className="shrink-0 font-medium text-[var(--text-h)]">You:</span>
              </>
            )}
            <span className="truncate">{last ? (last.body ?? 'Attachment') : 'No messages yet'}</span>
          </p>
          {c.unreadCount > 0 && (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10.5px] font-semibold text-[var(--ink)]">
              {c.unreadCount}
            </span>
          )}
        </div>
        {(c.blocked || (awaiting && c.unreadCount === 0) || agentName || tags.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {c.blocked && (
              <Badge tone="error">
                <Ban size={10} /> Blocked
              </Badge>
            )}
            {awaiting && c.unreadCount === 0 && (
              <Badge tone="success">
                <CornerDownLeft size={10} /> Awaiting reply
              </Badge>
            )}
            {agentName && <Badge tone="info">{agentName}</Badge>}
            {tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

/** A pipeline lead nobody has chatted with yet: tap to start the conversation. */
function LeadRow({ lead, disabled, onOpen }: { lead: CrmLead; disabled: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
    >
      <Avatar name={lead.contact_name ?? 'Unknown'} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[var(--text-h)]">{lead.contact_name ?? 'Unknown contact'}</p>
        <p className="truncate text-[12.5px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
      </div>
      {lead.lead_status && <Badge tone="accent">{lead.lead_status}</Badge>}
    </button>
  )
}

export function InboxPage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [panelTab, setPanelTabState] = useState<PanelTab>(() => (readStored(TAB_KEY) === 'pipeline' ? 'pipeline' : 'inbox'))
  const [pipelineChoice, setPipelineChoice] = useState<string | null>(() => readStored(PIPELINE_KEY))

  const { data: allConversations = [], isLoading, isError } = useConversations(search || undefined)
  // Anyone with the admin role sees every chat, so each row says whose it is.
  const { data: staff = [] } = useStaffList()
  const staffName = useMemo(
    () => new Map(staff.map((s) => [s.user_id, [s.first_name, s.last_name].filter(Boolean).join(' ').trim()])),
    [staff],
  )

  // A shell made by starting a chat that was never sent to stays out of the lists.
  const conversations = useMemo(() => allConversations.filter((c) => c.lastMessage !== null), [allConversations])

  const { data: pipelines = [] } = useMyLeadCampaigns()
  // A remembered pipeline that is gone (or not this user's) falls back to the first.
  const pipeline = pipelines.find((p) => p.id === pipelineChoice) ?? pipelines[0] ?? null
  const leadsPage = useCampaignLeadsPage({ campaignId: pipeline?.id ?? '', staffId: '', anyStaff: true, scope: 'mine', search })
  const startConversation = useStartConversation()

  function setPanelTab(tab: PanelTab) {
    setPanelTabState(tab)
    writeStored(TAB_KEY, tab)
  }
  function choosePipeline(id: string) {
    setPipelineChoice(id)
    writeStored(PIPELINE_KEY, id)
  }
  function openLead(contactId: string) {
    startConversation.mutate(contactId, {
      onSuccess: (conversation) => navigate(`/inbox/${conversation.id}`),
      onError: (err) => show({ title: err instanceof Error ? err.message : 'Failed to open conversation', tone: 'error' }),
    })
  }

  // Pipeline view: this pipeline's chats first, then its leads nobody has chatted with yet.
  const pipelineView = useMemo(() => {
    if (!pipeline) return { chats: [] as Conversation[], noChat: [] as CrmLead[] }
    const chats = conversations.filter((c) => c.leadCampaignNames?.includes(pipeline.name)).sort(byLatest)
    const chatted = new Set(allConversations.filter((c) => c.lastMessage !== null).map((c) => c.contactId))
    return { chats, noChat: leadsPage.items.filter((l) => !chatted.has(l.contact_id)) }
  }, [pipeline, conversations, allConversations, leadsPage.items])

  const shownChats = panelTab === 'pipeline' ? pipelineView.chats : [...conversations].sort(byLatest)
  const counts = useMemo(
    () => ({
      all: shownChats.length,
      unread: shownChats.filter((c) => c.unreadCount > 0).length,
      awaiting: shownChats.filter(isAwaiting).length,
    }),
    [shownChats],
  )
  const visible = useMemo(
    () => shownChats.filter((c) => (filter === 'unread' ? c.unreadCount > 0 : filter === 'awaiting' ? isAwaiting(c) : true)),
    [shownChats, filter],
  )
  const agentFor = (c: Conversation) => (c.assignedAgentId && staffName.get(c.assignedAgentId)) || undefined
  const renderChat = (c: Conversation) => <ConversationRow key={c.id} conversation={c} agentName={agentFor(c)} onOpen={() => navigate(`/inbox/${c.id}`)} />

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col border-x border-[var(--border)] bg-[var(--surface)]">
      <div className="shrink-0 space-y-2.5 border-b border-[var(--border)] p-3">
        <div role="tablist" className="flex rounded-lg bg-[var(--surface-hover)] p-1">
          {PANEL_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={panelTab === t.value}
              onClick={() => setPanelTab(t.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                panelTab === t.value ? 'bg-[var(--surface)] text-[var(--accent-strong)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
              )}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {panelTab === 'pipeline' && (
          <select
            aria-label="Pipeline"
            value={pipeline?.id ?? ''}
            onChange={(e) => choosePipeline(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-[13px] font-medium text-[var(--text-h)] outline-none focus:border-[var(--accent-border)]"
          >
            {pipelines.length === 0 && <option value="">No pipelines yet</option>}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <SearchBox value={search} onSubmit={setSearch} placeholder="Search name or number" />
        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Filter chats">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                filter === f.value
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
              )}
            >
              {f.label} <span className="tabular-nums opacity-70">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">Couldn't load your chats. Pull down to try again.</p>
        ) : panelTab === 'pipeline' ? (
          !pipeline ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">You aren't on any pipeline yet.</p>
          ) : visible.length === 0 && (filter !== 'all' || pipelineView.noChat.length === 0) ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
              {leadsPage.isLoading ? 'Loading…' : search ? `No one in “${pipeline.name}” matches “${search}”.` : `No chats in “${pipeline.name}”.`}
            </p>
          ) : (
            <>
              {visible.map(renderChat)}
              {/* Filters are about chats, so with one on, leads who never chatted are left out. */}
              {filter === 'all' && pipelineView.noChat.length > 0 && (
                <>
                  <p className="sticky top-0 z-[1] border-b border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    No chat yet · {pipelineView.noChat.length}
                  </p>
                  {pipelineView.noChat.map((lead) => (
                    <LeadRow key={lead.id} lead={lead} disabled={startConversation.isPending} onOpen={() => openLead(lead.contact_id)} />
                  ))}
                </>
              )}
              <InfiniteScrollFooter hasNextPage={Boolean(leadsPage.hasNextPage)} isFetchingNextPage={leadsPage.isFetchingNextPage} onLoadMore={() => void leadsPage.fetchNextPage()} />
            </>
          )
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search
              ? `No chats match “${search}”.`
              : filter !== 'all'
                ? 'No chats in this view.'
                : 'No chats yet. Open one of your leads and tap Company WhatsApp to start a chat.'}
          </p>
        ) : (
          visible.map(renderChat)
        )}
      </div>
    </div>
  )
}
