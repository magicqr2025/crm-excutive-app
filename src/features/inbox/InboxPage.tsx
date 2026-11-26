import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Ban, Check, CheckCheck, ChevronDown, CornerDownLeft, Inbox as InboxIcon, Megaphone, MessageCirclePlus, MessagesSquare, Search } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'
import { useCampaignLeadsPage, useMyLeadCampaigns, useStaffList } from '@/api/queries'
import type { CrmLead, CrmMyLeadCampaign } from '@/api/crmApi'
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
/** Chat-list preview for a last message that has no text of its own. */
const EMPTY_PREVIEW: Record<string, string> = {
  image: '📷 Photo',
  video: '🎥 Video',
  audio: '🎤 Voice note',
  document: '📄 Document',
  template: 'Template',
  unsupported: 'Unsupported message',
}

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

// Same card shell as the lead cards (LeadCard): soft ring + shadow, rounded-2xl.
const CARD =
  'flex w-full gap-3 rounded-2xl bg-[var(--surface)] p-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 transition-[box-shadow,background-color] hover:shadow-[0_10px_24px_-14px_rgba(29,22,56,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'

function ConversationRow({ conversation: c, agentName, onOpen }: { conversation: Conversation; agentName?: string; onOpen: () => void }) {
  const last = c.lastMessage
  const awaiting = isAwaiting(c)
  const unread = c.unreadCount > 0
  const tags = c.tags ?? []
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(CARD, 'items-start', unread ? 'bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] ring-[var(--accent-border)]' : 'ring-[var(--border)]')}
    >
      {/* Avatar with a dot while the customer is waiting for an answer. */}
      <span className="relative shrink-0">
        <Avatar name={c.contactName} size={46} />
        {awaiting && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[var(--success)] ring-2 ring-[var(--surface)]" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-[14.5px] leading-tight tracking-[-0.01em] text-[var(--text-h)]', unread ? 'font-bold' : 'font-semibold')}>{c.contactName}</span>
          <span className={cn('shrink-0 font-mono-num text-[11px]', unread ? 'font-semibold text-[var(--accent-strong)]' : 'text-[var(--text-muted)]')}>
            {formatListTime(c.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {/* Who spoke last: "You:" + delivery ticks for ours, darker when it is the customer's turn. */}
          <p className={cn('flex min-w-0 items-center gap-1 text-[13px]', unread || awaiting ? 'font-medium text-[var(--text-h)]' : 'text-[var(--text-muted)]')}>
            {last?.direction === 'out' && (
              <>
                <DeliveryTick status={last.status} />
                <span className="shrink-0 font-medium text-[var(--text-h)]">You:</span>
              </>
            )}
            <span className="truncate">{last ? last.body || EMPTY_PREVIEW[last.kind ?? ''] || 'Attachment' : 'No messages yet'}</span>
          </p>
          {unread && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono-num text-[11px] font-bold text-[var(--ink)]">
              {c.unreadCount}
            </span>
          )}
        </div>
        {(c.blocked || (awaiting && !unread) || agentName || tags.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            {c.blocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--error-bg)] px-2 py-0.5 font-semibold text-[var(--error)]">
                <Ban size={11} /> Blocked
              </span>
            )}
            {awaiting && !unread && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-bg)] px-2 py-0.5 font-semibold text-[var(--success)]">
                <CornerDownLeft size={11} /> Awaiting reply
              </span>
            )}
            {/* Whose chat it is: the same owner pill as the lead cards. */}
            {agentName && (
              <span className="inline-flex max-w-[140px] items-center gap-1.5 rounded-full bg-[var(--surface-hover)] py-0.5 pl-0.5 pr-2 font-medium text-[var(--text-h)]">
                <Avatar name={agentName} size={18} />
                <span className="truncate">{agentName.split(' ')[0]}</span>
              </span>
            )}
            {tags.map((tag) => (
              <span key={tag} className="inline-flex max-w-full items-center gap-0.5 px-1 py-0.5 text-[var(--text-muted)]">
                <span className="opacity-60">#</span>
                <span className="truncate">{tag}</span>
              </span>
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
    <button type="button" onClick={onOpen} disabled={disabled} className={cn(CARD, 'items-center ring-[var(--border)] disabled:opacity-60')}>
      <Avatar name={lead.contact_name ?? 'Unknown'} size={42} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold leading-tight text-[var(--text-h)]">{lead.contact_name ?? 'Unknown contact'}</p>
        <p className="mt-1 truncate font-mono-num text-[12.5px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
        {lead.lead_status && (
          <span
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-[var(--text-h)]"
            style={{ background: `color-mix(in srgb, ${lead.lead_status_color || 'var(--accent)'} 16%, transparent)` }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: lead.lead_status_color || 'var(--accent)' }} />
            <span className="truncate">{lead.lead_status}</span>
          </span>
        )}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-bg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-strong)]">
        <MessageCirclePlus size={14} /> Start chat
      </span>
    </button>
  )
}

/**
 * Pipeline chooser: a button that looks like the rest of the page, opening a sheet (bottom on a phone,
 * centred card on desktop) with a search once the list is long. Replaces the browser's native <select>,
 * whose drop-down can't be styled and spilled past the phone frame.
 */
function PipelinePicker({ pipelines, value, onChange }: { pipelines: CrmMyLeadCampaign[]; value: CrmMyLeadCampaign | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? pipelines.filter((p) => p.name.toLowerCase().includes(q)) : pipelines

  function close() {
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pipelines.length === 0}
        aria-haspopup="dialog"
        className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--surface)] pl-2 pr-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[var(--border)] transition-shadow hover:ring-[var(--accent-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent-strong)]">
          <Megaphone size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Pipeline</span>
          <span className="block truncate text-[14px] font-semibold leading-tight text-[var(--text-h)]">{value?.name ?? 'No pipelines yet'}</span>
        </span>
        {value && <span className="shrink-0 font-mono-num text-[11.5px] text-[var(--text-muted)]">{value.lead_count} leads</span>}
        <ChevronDown size={17} className="shrink-0 text-[var(--text-muted)]" />
      </button>

      <Dialog open={open} onClose={close} variant="sheet">
        <Dialog.Header>
          <Dialog.Title>Choose a pipeline</Dialog.Title>
          <Dialog.CloseButton onClose={close} />
        </Dialog.Header>
        {pipelines.length > 6 && (
          <div className="border-b border-[var(--border)] px-4 py-3">
            <label className="relative block">
              <span className="sr-only">Search pipelines</span>
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pipelines"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-[14px] text-[var(--text-h)] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-bg)]"
              />
            </label>
          </div>
        )}
        <div role="listbox" aria-label="Pipelines" className="flex-1 overflow-y-auto p-2">
          {shown.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">No pipeline matches “{query}”.</p>
          ) : (
            shown.map((p) => {
              const on = p.id === value?.id
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(p.id)
                    close()
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                    on ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <span className={cn('min-w-0 flex-1 truncate text-[14px]', on ? 'font-bold text-[var(--accent-strong)]' : 'font-medium text-[var(--text-h)]')}>{p.name}</span>
                  <span className="shrink-0 font-mono-num text-[11.5px] text-[var(--text-muted)]">{p.lead_count}</span>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      on ? 'bg-[var(--accent)] text-[var(--ink)]' : 'ring-1 ring-[var(--border)]',
                    )}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </Dialog>
    </>
  )
}

/** An empty or error list: an icon, one line on what is going on, and what to do next. */
function ListNote({ icon: Icon, title, hint, tone = 'muted' }: { icon: typeof InboxIcon; title: string; hint?: string; tone?: 'muted' | 'error' }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', tone === 'error' ? 'bg-[var(--error-bg)] text-[var(--error)]' : 'bg-[var(--accent-bg)] text-[var(--accent-strong)]')}>
        <Icon size={22} />
      </span>
      <p className="text-[14px] font-semibold text-[var(--text-h)]">{title}</p>
      {hint && <p className="max-w-xs text-[12.5px] text-[var(--text-muted)]">{hint}</p>}
    </div>
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
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col bg-[var(--bg)]">
      <div className="shrink-0 space-y-3 px-3 pb-3 pt-3 sm:px-4">
        {/* Inbox / Pipeline: a pill switch, the active side filled violet. */}
        <div role="tablist" className="flex rounded-full bg-[var(--surface)] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[var(--border)]">
          {PANEL_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={panelTab === t.value}
              onClick={() => setPanelTab(t.value)}
              className={cn(
                'flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
                panelTab === t.value
                  ? 'bg-[var(--accent)] text-[var(--ink)] shadow-[0_8px_18px_-10px_var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
              )}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {panelTab === 'pipeline' && (
          <PipelinePicker pipelines={pipelines} value={pipeline} onChange={choosePipeline} />
        )}

        <SearchBox value={search} onSubmit={setSearch} placeholder="Search name or number" />
        {/* Filters: chips with their own count bubble; the chosen one is filled violet. */}
        <div className="scrollbar-thin -mx-3 flex gap-2 overflow-x-auto px-3 sm:-mx-4 sm:px-4" role="tablist" aria-label="Filter chats">
          {FILTERS.map((f) => {
            const on = filter === f.value
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-2 rounded-full pl-3.5 pr-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
                  on
                    ? 'bg-[var(--accent)] text-[var(--ink)]'
                    : 'bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)] hover:text-[var(--text-h)]',
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'min-w-6 rounded-full px-1.5 py-0.5 text-center font-mono-num text-[11px] font-bold',
                    on ? 'bg-white/20' : f.value === 'unread' && counts.unread > 0 ? 'bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'bg-[var(--surface-hover)]',
                  )}
                >
                  {counts[f.value]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 sm:px-4">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <ListNote icon={AlertCircle} tone="error" title="Couldn't load your chats" hint="Check your connection, then pull down or reopen Inbox to try again." />
        ) : panelTab === 'pipeline' ? (
          !pipeline ? (
            <ListNote icon={Megaphone} title="You aren't on any pipeline yet" hint="Ask your admin to add you to a pipeline." />
          ) : visible.length === 0 && (filter !== 'all' || pipelineView.noChat.length === 0) ? (
            leadsPage.isLoading ? (
              <PageLoader />
            ) : (
              <ListNote
                icon={search ? Search : MessagesSquare}
                title={search ? `No one in “${pipeline.name}” matches “${search}”` : `No chats in “${pipeline.name}”`}
              />
            )
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map(renderChat)}
              {/* Filters are about chats, so with one on, leads who never chatted are left out. */}
              {filter === 'all' && pipelineView.noChat.length > 0 && (
                <>
                  <p className="sticky top-0 z-[1] -mx-3 mt-2 bg-[var(--bg)]/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] backdrop-blur sm:-mx-4 sm:px-5">
                    No chat yet · <span className="font-mono-num">{pipelineView.noChat.length}</span>
                  </p>
                  {pipelineView.noChat.map((lead) => (
                    <LeadRow key={lead.id} lead={lead} disabled={startConversation.isPending} onOpen={() => openLead(lead.contact_id)} />
                  ))}
                </>
              )}
              <InfiniteScrollFooter hasNextPage={Boolean(leadsPage.hasNextPage)} isFetchingNextPage={leadsPage.isFetchingNextPage} onLoadMore={() => void leadsPage.fetchNextPage()} />
            </div>
          )
        ) : visible.length === 0 ? (
          search ? (
            <ListNote icon={Search} title={`No chats match “${search}”`} hint="Try a name or the last digits of the number." />
          ) : filter !== 'all' ? (
            <ListNote icon={CheckCheck} title={filter === 'unread' ? 'All caught up' : 'Nobody is waiting for a reply'} hint="Switch to All to see every chat." />
          ) : (
            <ListNote icon={MessagesSquare} title="No chats yet" hint="Open one of your leads and tap Inbox to start a WhatsApp chat." />
          )
        ) : (
          <div className="flex flex-col gap-2">{visible.map(renderChat)}</div>
        )}
      </div>
    </div>
  )
}
